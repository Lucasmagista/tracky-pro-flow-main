import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { MFAService, type MFASetupResponse, type MFAAttempt } from '@/services/mfa'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Shield, ShieldCheck, ShieldAlert, Key, Copy, Check, Download, Clock } from 'lucide-react'
import QRCode from 'qrcode'
import { supabase } from '@/integrations/supabase/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function AdminMFA() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaVerified, setMfaVerified] = useState(false)
  const [setupDialogOpen, setSetupDialogOpen] = useState(false)
  const [disableDialogOpen, setDisableDialogOpen] = useState(false)
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false)
  const [setupData, setSetupData] = useState<MFASetupResponse | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [verificationCode, setVerificationCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [mfaAttempts, setMfaAttempts] = useState<MFAAttempt[]>([])
  const [userId, setUserId] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')

  useEffect(() => {
    loadMFAStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadMFAStatus = async () => {
    try {
      setIsLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not found')

      setUserId(user.id)
      setUserEmail(user.email || '')

      // Get MFA status
      const status = await MFAService.getMFAStatus(user.id)
      
      if (status) {
        setMfaEnabled(status.enabled)
        setMfaVerified(status.verified)

        if (status.enabled) {
          // Load backup codes
          const codes = await MFAService.getBackupCodes(user.id)
          setBackupCodes(codes)

          // Load attempts history
          const attempts = await MFAService.getMFAAttempts(user.id, 20)
          setMfaAttempts(attempts)
        }
      }
    } catch (error) {
      console.error('Error loading MFA status:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o status do MFA',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetupMFA = async () => {
    try {
      setIsLoading(true)

      const setup = await MFAService.setupMFA(userId, userEmail)
      setSetupData(setup)

      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(setup.qrCodeUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
      setQrCodeDataUrl(qrDataUrl)

      setSetupDialogOpen(false)
      setVerifyDialogOpen(true)

      toast({
        title: 'MFA Configurado',
        description: 'Escaneie o QR code com seu aplicativo autenticador',
      })
    } catch (error) {
      console.error('Error setting up MFA:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível configurar o MFA',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyMFA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: 'Código Inválido',
        description: 'Digite um código de 6 dígitos',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsLoading(true)

      const success = await MFAService.verifyAndEnableMFA(userId, verificationCode)

      if (success) {
        toast({
          title: 'MFA Ativado! 🎉',
          description: 'Autenticação de dois fatores ativada com sucesso',
        })

        setVerifyDialogOpen(false)
        await loadMFAStatus()
      } else {
        toast({
          title: 'Código Incorreto',
          description: 'O código digitado não é válido. Tente novamente.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error verifying MFA:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível verificar o código',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
      setVerificationCode('')
    }
  }

  const handleDisableMFA = async () => {
    try {
      setIsLoading(true)

      await MFAService.disableMFA(userId)

      toast({
        title: 'MFA Desativado',
        description: 'Autenticação de dois fatores foi desativada',
      })

      setDisableDialogOpen(false)
      await loadMFAStatus()
    } catch (error) {
      console.error('Error disabling MFA:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível desativar o MFA',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerateBackupCodes = async () => {
    try {
      setIsLoading(true)

      const newCodes = await MFAService.regenerateBackupCodes(userId)
      setBackupCodes(newCodes)

      toast({
        title: 'Códigos Regenerados',
        description: 'Novos códigos de backup foram gerados. Guarde-os em local seguro!',
      })
    } catch (error) {
      console.error('Error regenerating backup codes:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível regenerar os códigos',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(label)
    setTimeout(() => setCopiedCode(null), 2000)
    
    toast({
      title: 'Copiado!',
      description: `${label} copiado para a área de transferência`,
    })
  }

  const downloadBackupCodes = () => {
    const content = `TRACKY PRO FLOW - CÓDIGOS DE BACKUP MFA\n\n` +
      `Data: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}\n` +
      `Email: ${userEmail}\n\n` +
      `CÓDIGOS DE BACKUP (use apenas uma vez):\n\n` +
      backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n') +
      `\n\n⚠️ IMPORTANTE:\n` +
      `- Cada código pode ser usado apenas UMA vez\n` +
      `- Guarde estes códigos em local seguro\n` +
      `- Use-os se perder acesso ao seu autenticador\n`

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tracky-backup-codes-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: 'Download Iniciado',
      description: 'Códigos de backup salvos com sucesso',
    })
  }

  if (isLoading && !mfaEnabled) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Shield className="h-12 w-12 animate-pulse mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Carregando configurações de segurança...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Autenticação de Dois Fatores (MFA)
          </h1>
          <p className="text-muted-foreground mt-2">
            Adicione uma camada extra de segurança à sua conta de administrador
          </p>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Status do MFA</CardTitle>
                <CardDescription>
                  {mfaEnabled 
                    ? 'Sua conta está protegida com autenticação de dois fatores' 
                    : 'Configure o MFA para aumentar a segurança da sua conta'}
                </CardDescription>
              </div>
              <div>
                {mfaEnabled ? (
                  <Badge className="bg-green-500 hover:bg-green-600 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Ativado
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" />
                    Desativado
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!mfaEnabled ? (
              <>
                <Alert>
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Recomendação de Segurança</AlertTitle>
                  <AlertDescription>
                    Administradores devem usar MFA para proteger contas com acesso privilegiado.
                    O MFA adiciona uma segunda camada de verificação além da senha.
                  </AlertDescription>
                </Alert>

                <div className="pt-4">
                  <Button onClick={() => setSetupDialogOpen(true)} size="lg">
                    <Shield className="mr-2 h-5 w-5" />
                    Configurar MFA Agora
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Key className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-semibold">Aplicativo Autenticador</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Configurado e funcionando
                    </p>
                    <Badge className="mt-2" variant="outline">TOTP Ativo</Badge>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Copy className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-semibold">Códigos de Backup</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {backupCodes.length} códigos disponíveis
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={handleRegenerateBackupCodes}
                    >
                      Regenerar Códigos
                    </Button>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button 
                    variant="destructive"
                    onClick={() => setDisableDialogOpen(true)}
                  >
                    Desativar MFA
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Backup Codes Card */}
        {mfaEnabled && backupCodes.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Códigos de Backup</CardTitle>
                  <CardDescription>
                    Use estes códigos se perder acesso ao seu aplicativo autenticador
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={downloadBackupCodes}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Códigos
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertDescription>
                  <strong>⚠️ Importante:</strong> Cada código pode ser usado apenas UMA vez. 
                  Guarde-os em local seguro e offline.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {backupCodes.map((code, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-mono font-semibold">{code}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => copyToClipboard(code, `Código ${index + 1}`)}
                    >
                      {copiedCode === `Código ${index + 1}` ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        {mfaEnabled && mfaAttempts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Atividade Recente
              </CardTitle>
              <CardDescription>
                Histórico de tentativas de verificação MFA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mfaAttempts.slice(0, 10).map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      {attempt.success ? (
                        <ShieldCheck className="h-5 w-5 text-green-500" />
                      ) : (
                        <ShieldAlert className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {attempt.attempt_type === 'totp' ? 'Código TOTP' :
                           attempt.attempt_type === 'backup_code' ? 'Código de Backup' :
                           'Recuperação'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(attempt.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={attempt.success ? 'default' : 'destructive'}>
                      {attempt.success ? 'Sucesso' : 'Falha'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Setup Confirmation Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Autenticação de Dois Fatores</DialogTitle>
            <DialogDescription>
              Você precisará de um aplicativo autenticador (Google Authenticator, Authy, etc.)
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Antes de continuar</AlertTitle>
            <AlertDescription>
              Certifique-se de ter um aplicativo autenticador instalado no seu smartphone.
              Recomendamos Google Authenticator, Authy ou Microsoft Authenticator.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSetupMFA} disabled={isLoading}>
              {isLoading ? 'Configurando...' : 'Continuar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify MFA Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
            <DialogDescription>
              Use seu aplicativo autenticador para escanear o código abaixo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* QR Code */}
            {qrCodeDataUrl && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={qrCodeDataUrl} alt="QR Code" className="w-64 h-64" />
              </div>
            )}

            {/* Manual Entry */}
            {setupData && (
              <Alert>
                <AlertDescription>
                  <p className="text-xs mb-2"><strong>Ou digite manualmente:</strong></p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1">
                      {setupData.manualEntryCode}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(setupData.manualEntryCode, 'Código')}
                    >
                      {copiedCode === 'Código' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Verification Code Input */}
            <div className="space-y-2">
              <Label htmlFor="verification-code">Digite o código de 6 dígitos</Label>
              <Input
                id="verification-code"
                type="text"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>

            {/* Backup Codes Preview */}
            {setupData && (
              <Alert>
                <Key className="h-4 w-4" />
                <AlertTitle>Códigos de Backup Gerados</AlertTitle>
                <AlertDescription>
                  <p className="text-xs mb-2">
                    Após ativar o MFA, você poderá visualizar e baixar {setupData.backupCodes.length} códigos de backup.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use-os para acessar sua conta se perder o aplicativo autenticador.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleVerifyMFA} 
              disabled={isLoading || verificationCode.length !== 6}
            >
              {isLoading ? 'Verificando...' : 'Ativar MFA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable MFA Dialog */}
      <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar Autenticação de Dois Fatores</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desativar o MFA? Isso reduzirá a segurança da sua conta.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription>
              Desativar o MFA deixará sua conta mais vulnerável a acessos não autorizados.
              Recomendamos manter esta proteção ativa.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDisableMFA}
              disabled={isLoading}
            >
              {isLoading ? 'Desativando...' : 'Sim, Desativar MFA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
