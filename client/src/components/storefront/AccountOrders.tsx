import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/lib/authStore";
import { useCartStore } from "@/stores/cartStore";
import {
  orderHistoryService,
  type CustomerOrder,
} from "@/lib/orderHistoryService";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function AccountOrders() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const userId =
    !isLoading && isAuthenticated
      ? (user?.id as string | undefined)
      : undefined;
  const [, setLocation] = useLocation();
  const [state, setState] = useState<{
    owner?: string;
    orders: CustomerOrder[];
    total: number;
    loading: boolean;
    error: string;
  }>({ orders: [], total: 0, loading: false, error: "" });
  const [retry, setRetry] = useState(0);
  const [reordering, setReordering] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setState({ orders: [], total: 0, loading: false, error: "" });
      return;
    }
    setState({ owner: userId, orders: [], total: 0, loading: true, error: "" });
    orderHistoryService
      .getPage(userId)
      .then(result => {
        if (!cancelled)
          setState({ owner: userId, ...result, loading: false, error: "" });
      })
      .catch(() => {
        if (!cancelled)
          setState({
            owner: userId,
            orders: [],
            total: 0,
            loading: false,
            error: "Could not load your orders. Please try again.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, retry]);
  const visible =
    state.owner === userId
      ? state
      : { orders: [], total: 0, loading: !!userId, error: "" };
  const stillSignedIn = () => {
    const auth = useAuthStore.getState();
    return auth.isAuthenticated && !auth.isLoading && auth.user?.id === userId;
  };
  const loadMore = async () => {
    if (!userId || visible.loading) return;
    setState(current => ({ ...current, loading: true, error: "" }));
    try {
      const result = await orderHistoryService.getPage(
        userId,
        visible.orders.length
      );
      if (stillSignedIn())
        setState(current => ({
          ...current,
          orders: [...current.orders, ...result.orders],
          total: result.total,
          loading: false,
        }));
    } catch {
      if (stillSignedIn())
        setState(current => ({
          ...current,
          loading: false,
          error: "Could not load more orders. Please try again.",
        }));
    }
  };
  const reorder = async (id: string) => {
    if (!userId || reordering) return;
    setReordering(id);
    try {
      const items = await orderHistoryService.prepareReorder(userId, id);
      if (!stillSignedIn()) return;
      useCartStore.getState().mergeReorder(items);
      toast.info(
        "Added to cart at current rates and ordering rules. Review and confirm to place an order."
      );
      setLocation("/cart");
    } catch (error) {
      if (stillSignedIn())
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not prepare reorder. Your cart has not changed."
        );
    } finally {
      setReordering(null);
    }
  };
  return (
    <section
      aria-label="Order history"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <h2 className="border-b border-slate-100 px-4 py-3 text-heading-sub-lg font-extrabold text-slate-900 lg:text-heading-sub">
        Order history
      </h2>
      {!userId ? (
        <p className="p-4 text-caption text-slate-500">
          {isLoading ? (
            "Checking your account…"
          ) : (
            <>
              <Link href="/auth" className="font-semibold text-red-600">
                Sign in
              </Link>{" "}
              to view your orders.
            </>
          )}
        </p>
      ) : (
        <>
          <p className="px-4 pt-3 text-caption text-slate-500">
            Reorder adds items to your existing cart using current rates, pack
            sizes, minimums and steps. Review quantities and confirm checkout
            separately.
          </p>
          {visible.error && (
            <p role="alert" className="px-4 pt-3 text-caption text-red-700">
              {visible.error}{" "}
              <Button
                variant="outline"
                onClick={() =>
                  visible.orders.length ? loadMore() : setRetry(n => n + 1)
                }
              >
                Try again
              </Button>
            </p>
          )}
          {visible.loading && (
            <p role="status" className="p-4 text-caption text-slate-500">
              Loading orders…
            </p>
          )}
          {!visible.loading && !visible.error && !visible.orders.length && (
            <p className="p-4 text-caption text-slate-500">
              No saved orders yet.
            </p>
          )}
          {!!visible.orders.length && (
            <p className="px-4 py-2 text-caption text-slate-500">
              Showing {visible.orders.length} of {visible.total} orders
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {visible.orders.map(order => (
              <li key={order.id} className="space-y-2 p-4">
                <div className="flex flex-wrap justify-between gap-2 text-caption font-semibold">
                  <span>
                    {order.created_at
                      ? new Date(order.created_at).toLocaleDateString("en-IN")
                      : "Date unavailable"}{" "}
                    · {order.status || "Status unavailable"}
                  </span>
                  <span>Order {order.id.slice(0, 8)}</span>
                </div>
                <ul className="text-caption text-slate-600">
                  {order.order_items.map((item, index) => (
                    <li key={index}>
                      {item.product_name || "Saved product"} · {item.quantity}{" "}
                      selling units
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-caption text-slate-600">
                    Saved total:{" "}
                    {order.total_amount != null &&
                    Number.isFinite(order.total_amount) &&
                    order.total_amount > 0
                      ? `₹${order.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "On enquiry"}
                  </span>
                  <Button
                    variant="outline"
                    disabled={!!reordering || !order.order_items.length}
                    onClick={() => reorder(order.id)}
                  >
                    {reordering === order.id ? "Preparing cart…" : "Reorder"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {visible.orders.length < visible.total && (
            <div className="p-4">
              <Button
                variant="outline"
                disabled={visible.loading}
                onClick={loadMore}
              >
                Load more orders
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
