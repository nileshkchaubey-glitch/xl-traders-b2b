import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageCircle, Eye, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase, Enquiry } from "@/lib/supabase";
import { openWhatsApp } from "@/lib/whatsapp";

/**
 * Admin Enquiries Component
 *
 * Features:
 * - View all customer enquiries
 * - Filter by status
 * - Update enquiry status
 * - Send WhatsApp message
 * - View enquiry details
 */
export default function AdminEnquiries() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  // Load enquiries
  useEffect(() => {
    loadEnquiries();
  }, []);

  const loadEnquiries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("enquiries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEnquiries(data || []);
    } catch (error) {
      toast.error("Failed to load enquiries");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filter enquiries
  const filteredEnquiries =
    statusFilter === "all"
      ? enquiries
      : enquiries.filter(e => e.status === statusFilter);

  // Update enquiry status
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("enquiries")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      setEnquiries(
        enquiries.map(e => (e.id === id ? { ...e, status: newStatus } : e))
      );

      if (selectedEnquiry?.id === id) {
        setSelectedEnquiry({ ...selectedEnquiry, status: newStatus });
      }

      toast.success("Status updated");
    } catch (error) {
      toast.error("Failed to update status");
      console.error(error);
    }
  };

  // Send WhatsApp message
  const handleSendWhatsApp = (enquiry: Enquiry) => {
    const message = `Hi ${enquiry.customer_name}, Thank you for your enquiry. We received your request for ${enquiry.quantity_requested || "our products"}. Our team will contact you shortly.`;
    openWhatsApp(message, enquiry.customer_phone);
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-blue-100 text-blue-700",
      contacted: "bg-yellow-100 text-yellow-700",
      quoted: "bg-purple-100 text-purple-700",
      closed: "bg-green-100 text-green-700",
    };
    return colors[status] || "bg-slate-100 text-slate-700";
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Enquiries</h2>
          <p className="text-slate-600 text-sm mt-1">
            {filteredEnquiries.length} enquiries
          </p>
        </div>
        <Button onClick={loadEnquiries} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="quoted">Quoted</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Enquiries Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-slate-500"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredEnquiries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-slate-500"
                  >
                    No enquiries found
                  </TableCell>
                </TableRow>
              ) : (
                filteredEnquiries.map(enquiry => (
                  <TableRow key={enquiry.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-slate-900">
                          {enquiry.customer_name}
                        </p>
                        <p className="text-sm text-slate-600">
                          {enquiry.customer_phone}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {enquiry.customer_company || "-"}
                    </TableCell>
                    <TableCell>{enquiry.quantity_requested || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={enquiry.status}
                        onValueChange={value =>
                          handleStatusChange(enquiry.id, value)
                        }
                      >
                        <SelectTrigger
                          className={`w-32 text-xs ${getStatusColor(enquiry.status)}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="quoted">Quoted</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {formatDate(enquiry.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedEnquiry(enquiry)}
                          className="p-2 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSendWhatsApp(enquiry)}
                          className="p-2 hover:bg-green-50 rounded text-slate-600 hover:text-green-600"
                          title="Send WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Details Dialog */}
      {selectedEnquiry && (
        <Dialog
          open={!!selectedEnquiry}
          onOpenChange={() => setSelectedEnquiry(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Enquiry Details</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Customer Info */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">
                  Customer Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-600">Name:</span>
                    <p className="font-medium">
                      {selectedEnquiry.customer_name}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-600">Email:</span>
                    <p className="font-medium">
                      {selectedEnquiry.customer_email}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-600">Phone:</span>
                    <p className="font-medium">
                      {selectedEnquiry.customer_phone}
                    </p>
                  </div>
                  {selectedEnquiry.customer_company && (
                    <div>
                      <span className="text-slate-600">Company:</span>
                      <p className="font-medium">
                        {selectedEnquiry.customer_company}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Enquiry Info */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-slate-900 mb-2">
                  Enquiry Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-600">Quantity:</span>
                    <p className="font-medium">
                      {selectedEnquiry.quantity_requested || "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-600">Status:</span>
                    <p
                      className={`font-medium inline-block px-2 py-1 rounded text-xs mt-1 ${getStatusColor(selectedEnquiry.status)}`}
                    >
                      {selectedEnquiry.status}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-600">Date:</span>
                    <p className="font-medium">
                      {formatDate(selectedEnquiry.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Message */}
              {selectedEnquiry.message && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-slate-900 mb-2">Message</h3>
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded">
                    {selectedEnquiry.message}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="border-t pt-4 flex gap-2">
                <Button
                  onClick={() => handleSendWhatsApp(selectedEnquiry)}
                  className="flex-1 gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Send WhatsApp
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    window.open(
                      `mailto:${selectedEnquiry.customer_email}`,
                      "_blank"
                    )
                  }
                  className="flex-1 gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Email
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
