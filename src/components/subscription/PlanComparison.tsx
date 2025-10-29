import { Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';

interface Feature {
  name: string;
  starter: string | boolean;
  professional: string | boolean;
  enterprise: string | boolean;
}

const features: Feature[] = [
  { name: 'Pedidos/mês', starter: '100', professional: '500', enterprise: 'Ilimitado' },
  { name: 'Notificações/mês', starter: '500', professional: '2000', enterprise: 'Ilimitadas' },
  { name: 'Integrações ativas', starter: '2', professional: '5', enterprise: 'Ilimitadas' },
  { name: 'Storage de dados', starter: '1 GB', professional: '5 GB', enterprise: 'Ilimitado' },
  { name: 'Suporte', starter: 'Email', professional: 'Chat + Email', enterprise: 'Dedicado 24/7' },
  { name: 'API Access', starter: false, professional: true, enterprise: true },
  { name: 'Webhooks personalizados', starter: false, professional: true, enterprise: true },
  { name: 'White Label', starter: false, professional: false, enterprise: true },
  { name: 'Relatórios avançados', starter: false, professional: true, enterprise: true },
  { name: 'Exportação de dados', starter: 'CSV', professional: 'CSV + Excel', enterprise: 'Todos os formatos' },
  { name: 'SLA de uptime', starter: '99%', professional: '99.5%', enterprise: '99.9%' },
  { name: 'Período de teste', starter: '7 dias', professional: '14 dias', enterprise: '30 dias' },
];

export function PlanComparison() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Comparação Detalhada de Planos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left p-4 font-semibold text-gray-700">Recurso</th>
                  <th className="text-center p-4 font-semibold text-blue-600">Starter</th>
                  <th className="text-center p-4 font-semibold text-purple-600">Professional</th>
                  <th className="text-center p-4 font-semibold text-orange-600">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, index) => (
                  <motion.tr 
                    key={feature.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-4 font-medium text-gray-700">{feature.name}</td>
                    <td className="text-center p-4">
                      {typeof feature.starter === 'boolean' ? (
                        feature.starter ? (
                          <Check className="mx-auto text-green-500 w-5 h-5" />
                        ) : (
                          <X className="mx-auto text-red-500 w-5 h-5" />
                        )
                      ) : (
                        <span className="text-gray-600">{feature.starter}</span>
                      )}
                    </td>
                    <td className="text-center p-4">
                      {typeof feature.professional === 'boolean' ? (
                        feature.professional ? (
                          <Check className="mx-auto text-green-500 w-5 h-5" />
                        ) : (
                          <X className="mx-auto text-red-500 w-5 h-5" />
                        )
                      ) : (
                        <span className="text-gray-600">{feature.professional}</span>
                      )}
                    </td>
                    <td className="text-center p-4">
                      {typeof feature.enterprise === 'boolean' ? (
                        feature.enterprise ? (
                          <Check className="mx-auto text-green-500 w-5 h-5" />
                        ) : (
                          <X className="mx-auto text-red-500 w-5 h-5" />
                        )
                      ) : (
                        <span className="text-gray-600">{feature.enterprise}</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
