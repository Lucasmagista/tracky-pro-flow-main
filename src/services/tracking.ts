import { supabase } from '@/integrations/supabase/client'
import { TrackingCache } from './smartCache'
import { SmartenviosService } from './smartenvios'

export interface TrackingEvent {
  date: string
  time: string
  location: string
  status: string
  description: string
  carrier: string
}

export interface TrackingInfo {
  trackingCode: string
  carrier: string
  status: string
  events: TrackingEvent[]
  estimatedDelivery?: string
  lastUpdate: string
}

export interface CarrierConfig {
  name: string
  code: string
  apiUrl: string
  apiKey?: string
  webhookUrl?: string
  supported: boolean
}

export class TrackingService {
  private static readonly CARRIERS: Record<string, CarrierConfig> = {
    correios: {
      name: 'Correios',
      code: 'correios',
      apiUrl: 'https://proxyapp.correios.com.br/v1/sro-rastro',
      supported: true
    },
    smartenvios: {
      name: 'Smartenvios',
      code: 'smartenvios',
      apiUrl: 'https://api.smartenvios.com/v1',
      supported: true
    },
    fedex: {
      name: 'FedEx',
      code: 'fedex',
      apiUrl: 'https://apis.fedex.com/track/v1/trackingnumbers',
      supported: true
    },
    ups: {
      name: 'UPS',
      code: 'ups',
      apiUrl: 'https://onlinetools.ups.com/rest/Track',
      supported: true
    },
    dhl: {
      name: 'DHL',
      code: 'dhl',
      apiUrl: 'https://api-eu.dhl.com/track/shipments',
      supported: true
    },
    usps: {
      name: 'USPS',
      code: 'usps',
      apiUrl: 'https://api.usps.com/tracking/v3',
      supported: true
    }
  }

  static getSupportedCarriers(): CarrierConfig[] {
    return Object.values(this.CARRIERS).filter(carrier => carrier.supported)
  }

  static detectCarrier(trackingCode: string): string {
    // Smartenvios patterns
    if (SmartenviosService.detectTrackingCode(trackingCode)) {
      return 'smartenvios'
    }

    // Correios patterns (Brazil)
    if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(trackingCode) ||
        /^[A-Z]{2}\d{10}[A-Z]{2}$/.test(trackingCode)) {
      return 'correios'
    }

    // FedEx patterns
    if (/^\d{12,15}$/.test(trackingCode) ||
        /^\d{15,22}$/.test(trackingCode)) {
      return 'fedex'
    }

    // UPS patterns
    if (/^1Z[0-9A-Z]{16}$/.test(trackingCode) ||
        /^[0-9A-Z]{18}$/.test(trackingCode)) {
      return 'ups'
    }

    // DHL patterns
    if (/^\d{10,11}$/.test(trackingCode)) {
      return 'dhl'
    }

    // USPS patterns
    if (/^\d{22}$/.test(trackingCode) ||
        /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(trackingCode)) {
      return 'usps'
    }

    // Default to Correios for Brazilian market
    return 'correios'
  }

  static async trackPackage(trackingCode: string, carrier?: string): Promise<TrackingInfo> {
    const detectedCarrier = carrier || this.detectCarrier(trackingCode)

    if (!this.CARRIERS[detectedCarrier]?.supported) {
      throw new Error(`Transportadora não suportada: ${detectedCarrier}`)
    }

    // Check cache first
    const cached = await TrackingCache.get(trackingCode)
    if (cached && this.isCacheValid((cached as TrackingInfo).lastUpdate)) {
      return cached as TrackingInfo
    }

    // Track with specific carrier
    let trackingInfo: TrackingInfo

    switch (detectedCarrier) {
      case 'correios':
        trackingInfo = await this.trackCorreios(trackingCode)
        break
      case 'smartenvios':
        trackingInfo = await this.trackSmartenvios(trackingCode)
        break
      case 'fedex':
        trackingInfo = await this.trackFedEx(trackingCode)
        break
      case 'ups':
        trackingInfo = await this.trackUPS(trackingCode)
        break
      case 'dhl':
        trackingInfo = await this.trackDHL(trackingCode)
        break
      case 'usps':
        trackingInfo = await this.trackUSPS(trackingCode)
        break
      default:
        throw new Error(`Transportadora não implementada: ${detectedCarrier}`)
    }

    // Cache the result
    await TrackingCache.set(trackingCode, trackingInfo)

    return trackingInfo
  }

  private static async trackCorreios(trackingCode: string): Promise<TrackingInfo> {
    const { data, error } = await supabase.functions.invoke('track-correios', {
      body: { trackingCode }
    })

    if (error) {
      throw new Error(`Erro ao rastrear Correios: ${error.message}`)
    }

    return {
      trackingCode,
      carrier: 'correios',
      status: this.mapCorreiosStatus(data.eventos?.[0]?.status || 'Desconhecido'),
      events: data.eventos?.map((event: Record<string, unknown>) => ({
        date: event.data,
        time: event.hora,
        location: event.local,
        status: event.status,
        description: event.status,
        carrier: 'correios'
      })) || [],
      lastUpdate: new Date().toISOString()
    }
  }

  private static async trackSmartenvios(trackingCode: string): Promise<TrackingInfo> {
    try {
      // Use environment variable for API key
      const apiKey = import.meta.env.VITE_SMARTENVIOS_API_KEY || ''
      const environment: 'sandbox' | 'production' = (import.meta.env.VITE_SMARTENVIOS_ENVIRONMENT || 'production') as 'sandbox' | 'production'

      if (!apiKey) {
        throw new Error('API Key do Smartenvios não configurada')
      }

      const smartenviosTracking = await SmartenviosService.trackOrder(
        {
          api_key: apiKey,
          environment: environment
        },
        trackingCode
      )

      return {
        trackingCode,
        carrier: 'smartenvios',
        status: smartenviosTracking.status,
        events: smartenviosTracking.events.map(event => ({
          date: event.date.split('T')[0],
          time: event.date.split('T')[1]?.split('.')[0] || '',
          location: `${event.location.city}, ${event.location.state}`,
          status: event.status,
          description: event.description,
          carrier: 'smartenvios'
        })),
        estimatedDelivery: smartenviosTracking.estimated_delivery,
        lastUpdate: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Erro ao rastrear Smartenvios: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  private static async trackFedEx(trackingCode: string): Promise<TrackingInfo> {
    // FedEx tracking implementation
    const apiKey = import.meta.env.VITE_FEDEX_API_KEY

    if (!apiKey) {
      // Fallback to simulated data
      return this.getSimulatedTracking(trackingCode, 'fedex')
    }

    try {
      // Get access token first
      const tokenResponse = await fetch('https://apis.fedex.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: apiKey.split(':')[0],
          client_secret: apiKey.split(':')[1]
        })
      })

      const tokenData = await tokenResponse.json()

      // Track package
      const response = await fetch(`${this.CARRIERS.fedex.apiUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          trackingInfo: [{
            trackingNumberInfo: {
              trackingNumber: trackingCode
            }
          }]
        })
      })

      const data = await response.json()

      return this.parseFedExResponse(trackingCode, data)
    } catch (error) {
      console.error('FedEx API error:', error)
      return this.getSimulatedTracking(trackingCode, 'fedex')
    }
  }

  private static async trackUPS(trackingCode: string): Promise<TrackingInfo> {
    // UPS tracking implementation
    try {
      const response = await fetch(`${this.CARRIERS.ups.apiUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          UPSSecurity: {
            UsernameToken: {
              Username: process.env.UPS_USERNAME || 'demo',
              Password: process.env.UPS_PASSWORD || 'demo'
            },
            ServiceAccessToken: {
              AccessLicenseNumber: process.env.UPS_ACCESS_KEY || 'demo'
            }
          },
          TrackRequest: {
            Request: {
              RequestOption: '1'
            },
            TrackingNumber: trackingCode
          }
        })
      })

      const data = await response.json()

      return this.parseUPSResponse(trackingCode, data)
    } catch (error) {
      console.error('UPS API error:', error)
      return this.getSimulatedTracking(trackingCode, 'ups')
    }
  }

  private static async trackDHL(trackingCode: string): Promise<TrackingInfo> {
    // DHL tracking implementation
    try {
      const apiKey = import.meta.env.VITE_DHL_API_KEY
      const response = await fetch(`${this.CARRIERS.dhl.apiUrl}?trackingNumber=${trackingCode}`, {
        method: 'GET',
        headers: {
          'DHL-API-Key': apiKey || 'demo'
        }
      })

      const data = await response.json()

      return this.parseDHLResponse(trackingCode, data)
    } catch (error) {
      console.error('DHL API error:', error)
      return this.getSimulatedTracking(trackingCode, 'dhl')
    }
  }

  private static async trackUSPS(trackingCode: string): Promise<TrackingInfo> {
    // USPS tracking implementation
    try {
      const apiKey = import.meta.env.VITE_USPS_API_KEY
      const response = await fetch(`${this.CARRIERS.usps.apiUrl}/trackings/${trackingCode}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey || 'demo'}`
        }
      })

      const data = await response.json()

      return this.parseUSPSResponse(trackingCode, data)
    } catch (error) {
      console.error('USPS API error:', error)
      return this.getSimulatedTracking(trackingCode, 'usps')
    }
  }

  // Parsing methods for each carrier
  private static parseFedExResponse(trackingCode: string, data: any): TrackingInfo {
    const shipment = data.output?.completeTrackResults?.[0]?.trackResults?.[0]
    if (!shipment) {
      return this.getSimulatedTracking(trackingCode, 'fedex')
    }

    const events = shipment.scanEvents?.map((event: any) => ({
      date: event.date,
      time: event.time,
      location: `${event.scanLocation?.city}, ${event.scanLocation?.stateOrProvinceCode}`,
      status: event.eventDescription,
      description: event.eventDescription,
      carrier: 'fedex'
    })) || []

    return {
      trackingCode,
      carrier: 'fedex',
      status: this.mapFedExStatus(shipment.latestStatusDetail?.description || ''),
      events,
      estimatedDelivery: shipment.estimatedDeliveryDate,
      lastUpdate: new Date().toISOString()
    }
  }

  private static parseUPSResponse(trackingCode: string, data: any): TrackingInfo {
    const shipment = data.TrackResponse?.Shipment
    if (!shipment) {
      return this.getSimulatedTracking(trackingCode, 'ups')
    }

    const events = shipment.Package?.Activity?.map((activity: any) => ({
      date: activity.Date,
      time: activity.Time,
      location: activity.Location?.Description || '',
      status: activity.Status?.Description || '',
      description: activity.Status?.Description || '',
      carrier: 'ups'
    })) || []

    return {
      trackingCode,
      carrier: 'ups',
      status: this.mapUPSStatus(shipment.Package?.Activity?.[0]?.Status?.Description || ''),
      events,
      estimatedDelivery: shipment.ScheduledDeliveryDate,
      lastUpdate: new Date().toISOString()
    }
  }

  private static parseDHLResponse(trackingCode: string, data: any): TrackingInfo {
    const shipment = data.shipments?.[0]
    if (!shipment) {
      return this.getSimulatedTracking(trackingCode, 'dhl')
    }

    const events = shipment.events?.map((event: any) => ({
      date: event.timestamp.split('T')[0],
      time: event.timestamp.split('T')[1]?.substring(0, 5) || '',
      location: event.location?.address?.addressLocality || '',
      status: event.description,
      description: event.description,
      carrier: 'dhl'
    })) || []

    return {
      trackingCode,
      carrier: 'dhl',
      status: this.mapDHLStatus(shipment.status?.statusCode || ''),
      events,
      estimatedDelivery: shipment.estimatedTimeOfDelivery,
      lastUpdate: new Date().toISOString()
    }
  }

  private static parseUSPSResponse(trackingCode: string, data: any): TrackingInfo {
    const tracking = data.tracking
    if (!tracking) {
      return this.getSimulatedTracking(trackingCode, 'usps')
    }

    const events = tracking.events?.map((event: any) => ({
      date: event.eventDate,
      time: event.eventTime,
      location: event.eventCity + ', ' + event.eventState,
      status: event.eventDescription,
      description: event.eventDescription,
      carrier: 'usps'
    })) || []

    return {
      trackingCode,
      carrier: 'usps',
      status: this.mapUSPSStatus(tracking.status || ''),
      events,
      estimatedDelivery: tracking.expectedDeliveryDate,
      lastUpdate: new Date().toISOString()
    }
  }

  // Status mapping methods
  private static mapCorreiosStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'Postado': 'pending',
      'Encaminhado': 'in_transit',
      'Saiu para entrega': 'out_for_delivery',
      'Entregue': 'delivered',
      'Aguardando retirada': 'out_for_delivery',
      'Devolvido': 'returned',
      'Extraviado': 'failed',
      'Destinatário ausente': 'delayed'
    }

    for (const [key, value] of Object.entries(statusMap)) {
      if (status.toLowerCase().includes(key.toLowerCase())) {
        return value
      }
    }

    return 'in_transit'
  }

  private static mapFedExStatus(status: string): string {
    if (status.toLowerCase().includes('delivered')) return 'delivered'
    if (status.toLowerCase().includes('out for delivery')) return 'out_for_delivery'
    if (status.toLowerCase().includes('in transit')) return 'in_transit'
    if (status.toLowerCase().includes('picked up')) return 'pending'
    return 'in_transit'
  }

  private static mapUPSStatus(status: string): string {
    if (status.toLowerCase().includes('delivered')) return 'delivered'
    if (status.toLowerCase().includes('out for delivery')) return 'out_for_delivery'
    if (status.toLowerCase().includes('in transit')) return 'in_transit'
    if (status.toLowerCase().includes('picked up')) return 'pending'
    return 'in_transit'
  }

  private static mapDHLStatus(status: string): string {
    if (status.toLowerCase().includes('delivered')) return 'delivered'
    if (status.toLowerCase().includes('out for delivery')) return 'out_for_delivery'
    if (status.toLowerCase().includes('transit')) return 'in_transit'
    if (status.toLowerCase().includes('pre-transit')) return 'pending'
    return 'in_transit'
  }

  private static mapUSPSStatus(status: string): string {
    if (status.toLowerCase().includes('delivered')) return 'delivered'
    if (status.toLowerCase().includes('out for delivery')) return 'out_for_delivery'
    if (status.toLowerCase().includes('in transit')) return 'in_transit'
    if (status.toLowerCase().includes('accepted')) return 'pending'
    return 'in_transit'
  }

  // Simulated tracking for demo purposes
  private static getSimulatedTracking(trackingCode: string, carrier: string): TrackingInfo {
    const events: TrackingEvent[] = [
      {
        date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
        time: '14:30',
        location: 'Centro de Distribuição',
        status: 'Pacote postado',
        description: 'Pacote foi postado na agência',
        carrier
      },
      {
        date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        time: '09:15',
        location: 'Centro de Triagem',
        status: 'Em trânsito',
        description: 'Pacote em processo de transporte',
        carrier
      },
      {
        date: new Date().toISOString().split('T')[0],
        time: '16:45',
        location: 'Agência Local',
        status: 'Saiu para entrega',
        description: 'Pacote saiu para entrega no endereço',
        carrier
      }
    ]

    return {
      trackingCode,
      carrier,
      status: 'out_for_delivery',
      events,
      estimatedDelivery: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      lastUpdate: new Date().toISOString()
    }
  }

  // Cache methods
  private static async getCachedTracking(trackingCode: string): Promise<TrackingInfo | null> {
    try {
      const { data } = await supabase
        .from('tracking_cache')
        .select('*')
        .eq('tracking_code', trackingCode)
        .single()

      if (data) {
        return {
          trackingCode: data.tracking_code,
          carrier: data.carrier,
          status: data.status,
          events: (data.events as any) || [],
          estimatedDelivery: data.estimated_delivery,
          lastUpdate: data.last_update
        }
      }
    } catch (error) {
      // Cache miss or error
    }
    return null
  }

  private static async cacheTrackingInfo(info: TrackingInfo): Promise<void> {
    try {
      await supabase
        .from('tracking_cache')
        .upsert({
          tracking_code: info.trackingCode,
          carrier: info.carrier,
          status: info.status,
          events: info.events as any,
          estimated_delivery: info.estimatedDelivery,
          last_update: info.lastUpdate
        })
    } catch (error) {
      console.error('Error caching tracking info:', error)
    }
  }

  private static isCacheValid(lastUpdate: string): boolean {
    const cacheTime = new Date(lastUpdate).getTime()
    const now = Date.now()
    const cacheDuration = 30 * 60 * 1000 // 30 minutes

    return (now - cacheTime) < cacheDuration
  }
}