import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminService } from '@/services/admin'

interface AdminProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'super_admin' | 'admin' | 'moderator' | 'support'
}

export default function AdminProtectedRoute({ children, requiredRole }: AdminProtectedRouteProps) {
  const navigate = useNavigate()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    checkAdminAccess()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAdminAccess = async () => {
    try {
      const isAdmin = await AdminService.isAdmin()
      
      if (!isAdmin) {
        navigate('/dashboard')
        return
      }

      // Check specific role if required
      if (requiredRole) {
        const hasRole = await AdminService.hasAdminRole(requiredRole)
        if (!hasRole) {
          navigate('/dashboard')
          return
        }
      }

      setIsAuthorized(true)
    } catch (error) {
      console.error('Error checking admin access:', error)
      navigate('/dashboard')
    }
  }

  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}
