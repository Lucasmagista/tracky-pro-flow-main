import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUpdateOrder } from "@/hooks/useOrders";
import { Edit, Save, X } from "lucide-react";

interface Order {
  id: string;
  tracking_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  carrier: string;
  status: string;
  destination?: string;
  order_date?: string;
  estimated_delivery?: string;
  product_name?: string;
  quantity?: string;
  order_number?: string;
  notes?: string;
  order_value?: string;
}

interface OrderEditModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

const CARRIERS = [
  "Correios",
  "Jadlog",
  "Loggi",
  "Total Express",
  "Azul Cargo",
  "Transportadora Personalizada"
];

const STATUSES = [
  { value: "pending", label: "Aguardando" },
  { value: "in_transit", label: "Em Trânsito" },
  { value: "out_for_delivery", label: "Saiu para Entrega" },
  { value: "delivered", label: "Entregue" },
  { value: "delayed", label: "Atrasado" },
  { value: "failed", label: "Falha na Entrega" },
  { value: "returned", label: "Devolvido" },
];

const OrderEditModal: React.FC<OrderEditModalProps> = ({ order, isOpen, onClose }) => {
  const [formData, setFormData] = useState<Partial<Order>>({});
  const updateOrderMutation = useUpdateOrder();

  // Preencher formulário quando o pedido muda
  useEffect(() => {
    if (order) {
      setFormData({
        tracking_code: order.tracking_code,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone || "",
        carrier: order.carrier,
        status: order.status,
        destination: order.destination || "",
        order_date: order.order_date || "",
        estimated_delivery: order.estimated_delivery || "",
        product_name: order.product_name || "",
        quantity: order.quantity || "",
        order_number: order.order_number || "",
        notes: order.notes || "",
        order_value: order.order_value || "",
      });
    }
  }, [order]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    try {
      await updateOrderMutation.mutateAsync({
        orderId: order.id,
        updates: formData,
      });
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar pedido:", error);
    }
  };

  const formatDateForInput = (dateString?: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return "";
    }
  };

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Editar Pedido
          </DialogTitle>
          <DialogDescription>
            Atualize as informações do pedido #{order.tracking_code}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Informações Básicas</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tracking_code">Código de Rastreio *</Label>
                <Input
                  id="tracking_code"
                  value={formData.tracking_code || ""}
                  onChange={(e) => handleInputChange("tracking_code", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="order_number">Número do Pedido</Label>
                <Input
                  id="order_number"
                  value={formData.order_number || ""}
                  onChange={(e) => handleInputChange("order_number", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="carrier">Transportadora *</Label>
                <Select
                  value={formData.carrier || ""}
                  onValueChange={(value) => handleInputChange("carrier", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a transportadora" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRIERS.map((carrier) => (
                      <SelectItem key={carrier} value={carrier}>
                        {carrier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status || ""}
                  onValueChange={(value) => handleInputChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Informações do Cliente */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Informações do Cliente</h3>

            <div className="space-y-2">
              <Label htmlFor="customer_name">Nome do Cliente *</Label>
              <Input
                id="customer_name"
                value={formData.customer_name || ""}
                onChange={(e) => handleInputChange("customer_name", e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_email">E-mail do Cliente *</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={formData.customer_email || ""}
                  onChange={(e) => handleInputChange("customer_email", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_phone">Telefone</Label>
                <Input
                  id="customer_phone"
                  value={formData.customer_phone || ""}
                  onChange={(e) => handleInputChange("customer_phone", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Informações do Pedido */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Informações do Pedido</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product_name">Nome do Produto</Label>
                <Input
                  id="product_name"
                  value={formData.product_name || ""}
                  onChange={(e) => handleInputChange("product_name", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity || ""}
                  onChange={(e) => handleInputChange("quantity", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="order_value">Valor do Pedido</Label>
                <Input
                  id="order_value"
                  type="number"
                  step="0.01"
                  value={formData.order_value || ""}
                  onChange={(e) => handleInputChange("order_value", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination">Destino</Label>
                <Input
                  id="destination"
                  value={formData.destination || ""}
                  onChange={(e) => handleInputChange("destination", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="order_date">Data do Pedido</Label>
                <Input
                  id="order_date"
                  type="date"
                  value={formatDateForInput(formData.order_date)}
                  onChange={(e) => handleInputChange("order_date", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated_delivery">Previsão de Entrega</Label>
                <Input
                  id="estimated_delivery"
                  type="date"
                  value={formatDateForInput(formData.estimated_delivery)}
                  onChange={(e) => handleInputChange("estimated_delivery", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateOrderMutation.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              {updateOrderMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OrderEditModal;