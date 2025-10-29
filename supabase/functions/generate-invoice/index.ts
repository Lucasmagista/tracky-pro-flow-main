import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { billingId } = await req.json();

    // Buscar dados da fatura
    const { data: billing, error } = await supabaseAdmin
      .from('billing_history')
      .select('*, subscriptions(*, profiles(*), plans(*))')
      .eq('id', billingId)
      .single();

    if (error || !billing) {
      throw new Error('Fatura não encontrada');
    }

    // Gerar HTML da fatura
    const invoiceHTML = generateInvoiceHTML(billing);

    // Converter para PDF usando htmlpdf (você pode usar jsPDF ou outro)
    // Por ora, vamos retornar o HTML
    const fileName = `fatura-${billing.id}.html`;

    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('invoices')
      .upload(fileName, new Blob([invoiceHTML], { type: 'text/html' }), {
        contentType: 'text/html',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Pegar URL pública
    const { data: urlData } = supabaseAdmin
      .storage
      .from('invoices')
      .getPublicUrl(fileName);

    // Atualizar billing_history com URL
    await supabaseAdmin
      .from('billing_history')
      .update({ invoice_url: urlData.publicUrl })
      .eq('id', billingId);

    return new Response(
      JSON.stringify({ url: urlData.publicUrl }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

function generateInvoiceHTML(billing: any): string {
  const profile = billing.subscriptions.profiles;
  const plan = billing.subscriptions.plans;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      padding: 40px;
      color: #333;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 60px;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 3px solid #667eea;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .invoice-details {
      text-align: right;
    }
    .invoice-number {
      font-size: 24px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 10px;
    }
    .section {
      margin: 30px 0;
    }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 10px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin: 30px 0;
    }
    .info-block h3 {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 5px;
    }
    .info-block p {
      font-size: 14px;
      line-height: 1.6;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
    }
    thead {
      background: #f9fafb;
    }
    th {
      text-align: left;
      padding: 12px;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
    }
    td {
      padding: 16px 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .total-section {
      margin-top: 30px;
      text-align: right;
    }
    .total-row {
      display: flex;
      justify-content: flex-end;
      padding: 10px 0;
    }
    .total-label {
      width: 200px;
      font-weight: 600;
    }
    .total-value {
      width: 150px;
      text-align: right;
    }
    .grand-total {
      font-size: 24px;
      font-weight: bold;
      color: #667eea;
      padding-top: 15px;
      border-top: 2px solid #e5e7eb;
      margin-top: 10px;
    }
    .status {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-paid {
      background: #d1fae5;
      color: #065f46;
    }
    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }
    .footer {
      margin-top: 60px;
      padding-top: 30px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
    @media print {
      body { padding: 0; }
      .invoice-container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div>
        <div class="logo">Tracky Pro</div>
        <p style="margin-top: 8px; color: #6b7280;">Gestão Inteligente de Pedidos</p>
      </div>
      <div class="invoice-details">
        <div class="invoice-number">FATURA</div>
        <p>#${billing.id.substring(0, 8).toUpperCase()}</p>
        <p>${new Date(billing.created_at).toLocaleDateString('pt-BR')}</p>
        <div style="margin-top: 10px;">
          <span class="status status-${billing.status === 'paid' ? 'paid' : 'pending'}">
            ${billing.status === 'paid' ? 'PAGO' : 'PENDENTE'}
          </span>
        </div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-block">
        <h3>FATURADO PARA</h3>
        <p>
          <strong>${profile.name}</strong><br>
          ${profile.store_name}<br>
          ${profile.store_email}<br>
          ${profile.store_phone || ''}
        </p>
      </div>
      <div class="info-block">
        <h3>INFORMAÇÕES DE PAGAMENTO</h3>
        <p>
          <strong>Data de Emissão:</strong> ${new Date(billing.created_at).toLocaleDateString('pt-BR')}<br>
          <strong>Forma de Pagamento:</strong> Cartão de Crédito<br>
          <strong>Moeda:</strong> ${billing.currency}
        </p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>DESCRIÇÃO</th>
          <th>PERÍODO</th>
          <th style="text-align: right;">VALOR</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${plan.name}</strong><br>
            <span style="color: #6b7280; font-size: 13px;">${plan.description}</span>
          </td>
          <td>
            ${new Date(billing.subscriptions.current_period_start).toLocaleDateString('pt-BR')} - 
            ${new Date(billing.subscriptions.current_period_end).toLocaleDateString('pt-BR')}
          </td>
          <td style="text-align: right;">R$ ${billing.amount.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="total-section">
      <div class="total-row">
        <div class="total-label">Subtotal:</div>
        <div class="total-value">R$ ${billing.amount.toFixed(2)}</div>
      </div>
      <div class="total-row">
        <div class="total-label">Impostos:</div>
        <div class="total-value">R$ 0,00</div>
      </div>
      <div class="total-row grand-total">
        <div class="total-label">TOTAL:</div>
        <div class="total-value">R$ ${billing.amount.toFixed(2)}</div>
      </div>
    </div>

    <div class="footer">
      <p><strong>Tracky Pro - Gestão Inteligente de Pedidos</strong></p>
      <p style="margin-top: 10px;">
        Dúvidas? Entre em contato: suporte@trackypro.com<br>
        www.trackypro.com
      </p>
      <p style="margin-top: 20px; font-size: 11px;">
        Este documento é uma fatura eletrônica. Guarde-o para seus registros.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}
