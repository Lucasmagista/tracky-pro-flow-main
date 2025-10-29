export type OrderStatus = 
  | "pending"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "delayed"
  | "failed"
  | "returned";

export interface Order {
  id: string;
  trackingCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  status: OrderStatus;
  carrier: string;
  lastUpdate: string;
  estimatedDelivery?: string;
  origin: string;
  destination: string;
  createdAt: string;
}

export interface TrackingEvent {
  id: string;
  orderId: string;
  status: string;
  description: string;
  location: string;
  timestamp: string;
}
