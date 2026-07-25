export type PaymentMethod = "cartao" | "pix" | "dinheiro" | "marcado";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cartao: "Cartão",
  pix: "Pix",
  dinheiro: "Dinheiro",
  marcado: "Marcado",
};

export interface Product {
  id: number;
  name: string;
  price_cents: number;
  active: boolean;
}

export interface Person {
  id: number;
  name: string;
}

export interface SaleItem {
  product_name: string;
  unit_price_cents: number;
  quantity: number;
}

export interface Sale {
  id: number;
  total_cents: number;
  payment_method: PaymentMethod;
  person_id: number | null;
  person_name: string | null;
  paid: boolean;
  created_at: string;
  items: SaleItem[];
}
