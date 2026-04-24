import { useGetInvoice, getGetInvoiceQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, ArrowLeft, Building2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

export default function InvoiceDetail() {
  const { id } = useParams();
  const invoiceId = parseInt(id || "0", 10);

  const { data: invoice, isLoading } = useGetInvoice(invoiceId, {
    query: {
      enabled: !!invoiceId,
      queryKey: getGetInvoiceQueryKey(invoiceId),
    }
  });

  const handlePrint = () => {
    window.print();
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'paid': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'sent': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'draft': return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-32" />
        <Card>
          <CardContent className="p-8 space-y-8">
            <div className="flex justify-between">
              <Skeleton className="h-20 w-48" />
              <Skeleton className="h-20 w-48" />
            </div>
            <Skeleton className="h-64 w-full" />
            <div className="flex justify-end">
              <Skeleton className="h-32 w-64" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Invoice Not Found</h2>
        <p className="text-muted-foreground mt-2 mb-6">The invoice you're looking for doesn't exist or has been deleted.</p>
        <Button asChild>
          <Link href="/invoices">Back to Invoices</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" asChild className="-ml-4">
          <Link href="/invoices">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Link>
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print Invoice
        </Button>
      </div>

      <Card className="print:shadow-none print:border-none">
        <CardContent className="p-8 md:p-12 space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between gap-6 border-b pb-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Building2 className="h-8 w-8" />
                <h1 className="text-2xl font-bold tracking-tight">Office Control</h1>
              </div>
              <div className="text-sm text-muted-foreground pt-2">
                <p>123 Business Avenue</p>
                <p>Suite 100</p>
                <p>New York, NY 10001</p>
                <p>hello@office.app</p>
              </div>
            </div>
            <div className="md:text-right space-y-2">
              <h2 className="text-3xl font-bold text-slate-200">INVOICE</h2>
              <div className="pt-2 space-y-1">
                <p className="text-sm"><span className="font-medium text-muted-foreground mr-2">Invoice Number:</span> {invoice.invoiceNumber}</p>
                <p className="text-sm"><span className="font-medium text-muted-foreground mr-2">Issue Date:</span> {format(new Date(invoice.issueDate), 'MMM d, yyyy')}</p>
                {invoice.dueDate && (
                  <p className="text-sm"><span className="font-medium text-muted-foreground mr-2">Due Date:</span> {format(new Date(invoice.dueDate), 'MMM d, yyyy')}</p>
                )}
                <div className="pt-2">
                  <Badge variant="outline" className={`print:border-gray-300 ${getStatusColor(invoice.status)}`}>
                    {invoice.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Client Info */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Bill To:</h3>
            <p className="font-semibold text-lg">{invoice.clientName}</p>
          </div>

          {/* Line Items */}
          <div className="pt-4">
            <Table>
              <TableHeader>
                <TableRow className="border-t">
                  <TableHead className="w-[50%]">Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">${item.unitPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                      <TableCell className="text-right">${(item.quantity * item.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No line items</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="flex justify-end pt-4">
            <div className="w-full max-w-sm space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${(invoice.subtotal || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between text-sm pb-3 border-b">
                <span className="text-muted-foreground">Tax {(invoice.tax || 0)}%</span>
                <span>${((invoice.subtotal || 0) * ((invoice.tax || 0) / 100)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-1">
                <span>Total</span>
                <span>${invoice.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="pt-12 mt-12 border-t text-sm text-muted-foreground">
              <h4 className="font-medium text-foreground mb-2">Notes & Terms:</h4>
              <p className="whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}