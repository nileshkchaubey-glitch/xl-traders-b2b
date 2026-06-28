import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { orderService } from "@/lib/orderService";
import { Order, OrderItem, OrderStatus } from "@/lib/supabase";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  processing: "Processing",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  confirmed: "bg-yellow-100 text-yellow-700",
  processing: "bg-orange-100 text-orange-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-slate-100 text-slate-500",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface OrderRowProps {
  order: Order;
  onStatusChange: (id: string, status: OrderStatus) => void;
}

function OrderRow({ order, onStatusChange }: OrderRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const wa = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

  const handleExpand = async () => {
    setExpanded(v => !v);
    if (!expanded && items.length === 0) {
      setLoadingItems(true);
      try {
        const fetched = await orderService.getItems(order.id);
        setItems(fetched);
      } catch {
        toast.error("Failed to load items");
      } finally {
        setLoadingItems(false);
      }
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await orderService.updateStatus(order.id, newStatus as OrderStatus);
      onStatusChange(order.id, newStatus as OrderStatus);
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
        onClick={handleExpand}
      >
        <span className="text-slate-400 flex-shrink-0">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>

        <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm min-w-0">
          <div className="col-span-2 sm:col-span-1">
            <p className="font-semibold text-slate-900 truncate">
              {order.customer_name || "—"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatDate(order.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {order.phone ? (
              <a
                href={`https://wa.me/${wa.replace("+", "")}?text=${encodeURIComponent(`Hi ${order.customer_name || ""}, your order has been received.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-green-600 hover:underline text-xs font-semibold"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {order.phone}
              </a>
            ) : (
              <span className="text-slate-400 text-xs">—</span>
            )}
          </div>

          <div className="flex items-center gap-1 text-slate-600">
            <Package className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs">{order.item_count ?? "—"} items</span>
          </div>

          <div>
            <p className="font-bold text-red-600 text-sm">
              {order.total_amount != null
                ? `₹${Number(order.total_amount).toLocaleString()}`
                : "—"}
            </p>
          </div>

          <div onClick={e => e.stopPropagation()}>
            <Select
              value={order.status}
              onValueChange={handleStatusChange}
              disabled={updatingStatus}
            >
              <SelectTrigger
                className={`h-7 text-xs w-full border-0 px-2 font-semibold rounded-full ${STATUS_COLORS[order.status]}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as OrderStatus[]).map(s => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Expanded order items */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          {loadingItems ? (
            <div className="flex items-center gap-2 py-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading items…
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No items found</p>
          ) : (
            <div className="space-y-1.5">
              {items.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 text-sm bg-white border border-slate-100 rounded-lg px-3 py-2"
                >
                  <span className="font-semibold text-slate-700 w-8 text-center bg-slate-100 rounded px-1 py-0.5 text-xs">
                    {item.quantity}×
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {item.product_name}
                    </p>
                    {item.sku && (
                      <p className="text-xs text-slate-400">SKU: {item.sku}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-slate-900">
                      {item.subtotal != null
                        ? `₹${Number(item.subtotal).toLocaleString()}`
                        : "—"}
                    </p>
                    {item.unit_price != null && (
                      <p className="text-xs text-slate-400">
                        @ ₹{Number(item.unit_price).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {/* Order total */}
              <div className="flex justify-end pt-1">
                <span className="text-sm font-bold text-red-600">
                  Total: ₹
                  {items
                    .reduce((s, i) => s + (i.subtotal ?? 0), 0)
                    .toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await orderService.getAll();
      setOrders(data);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleStatusChange = (id: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => (o.id === id ? { ...o, status } : o)));
  };

  const filtered =
    statusFilter === "all"
      ? orders
      : orders.filter(o => o.status === statusFilter);

  const counts = orders.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
          {orders.length}
        </span>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {(Object.keys(STATUS_LABELS) as OrderStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className={`rounded-xl p-3 text-center border transition-all ${
              statusFilter === s
                ? "border-red-400 bg-red-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <p
              className={`text-2xl font-bold ${STATUS_COLORS[s].split(" ")[1]}`}
            >
              {counts[s] ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{STATUS_LABELS[s]}</p>
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={v => setStatusFilter(v as any)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All orders</SelectItem>
            {(Object.keys(STATUS_LABELS) as OrderStatus[]).map(s => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={loadOrders}
          className="text-xs text-slate-500 hover:text-red-600 underline"
        >
          Refresh
        </button>
      </div>

      {/* Orders list */}
      <Card className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-red-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-600">No orders yet</p>
            <p className="text-sm mt-1">
              Orders placed via the cart will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(order => (
              <OrderRow
                key={order.id}
                order={order}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
