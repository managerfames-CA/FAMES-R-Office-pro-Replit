import { useState } from "react";
import { useListInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, useListClients, getListInvoicesQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, MoreHorizontal, FileText, PlusCircle, Trash2, Printer } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link } from "wouter";

const invoiceFormSchema = z.object({
  clientId: z.coerce.number().min(1, "Client is required"),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  tax: z.coerce.number().min(0).optional(),
  items: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.coerce.number().min(1, "Must be > 0"),
    unitPrice: z.coerce.number().min(0, "Must be >= 0"),
  })).min(1, "At least one item is required"),
});

export default function Invoices() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState<number | null>(null);

  const { data: invoices, isLoading } = useListInvoices({
    status: statusFilter !== "all" ? statusFilter as any : undefined
  });
  const { data: clientList } = useListClients();
  
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();

  const form = useForm<z.infer<typeof invoiceFormSchema>>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      clientId: 0,
      status: "draft",
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: "",
      notes: "",
      tax: 0,
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Watch for totals calculation
  const watchItems = form.watch("items");
  const watchTax = form.watch("tax") || 0;
  
  const subtotal = watchItems.reduce((acc, item) => acc + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
  const taxAmount = subtotal * (watchTax / 100);
  const total = subtotal + taxAmount;

  const openCreate = () => {
    form.reset({
      clientId: 0,
      status: "draft",
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: "",
      notes: "",
      tax: 0,
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
    });
    setEditInvoiceId(null);
    setIsCreateOpen(true);
  };

  const openEdit = (invoice: any) => {
    form.reset({
      clientId: invoice.clientId,
      status: invoice.status,
      issueDate: invoice.issueDate.split('T')[0],
      dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : "",
      notes: invoice.notes || "",
      tax: invoice.tax || 0,
      items: invoice.items || [{ description: "", quantity: 1, unitPrice: 0 }],
    });
    setEditInvoiceId(invoice.id);
    setIsCreateOpen(true);
  };

  const onSubmit = async (values: z.infer<typeof invoiceFormSchema>) => {
    try {
      const dataToSubmit = {
        ...values,
        dueDate: values.dueDate || null,
        tax: values.tax || null,
      };

      if (editInvoiceId) {
        await updateInvoice.mutateAsync({ id: editInvoiceId, data: dataToSubmit as any });
        toast.success("Invoice updated");
      } else {
        await createInvoice.mutateAsync({ data: dataToSubmit as any });
        toast.success("Invoice created");
      }
      queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setIsCreateOpen(false);
    } catch (e) {
      toast.error(editInvoiceId ? "Failed to update invoice" : "Failed to create invoice");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    try {
      await deleteInvoice.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast.success("Invoice deleted");
    } catch (e) {
      toast.error("Failed to delete invoice");
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await updateInvoice.mutateAsync({ id, data: { status: newStatus as any } });
      queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast.success("Invoice status updated");
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'paid': return 'text-emerald-600 border-emerald-200 bg-emerald-50';
      case 'overdue': return 'text-red-600 border-red-200 bg-red-50';
      case 'sent': return 'text-blue-600 border-blue-200 bg-blue-50';
      case 'draft': return 'text-slate-600 border-slate-200 bg-slate-50';
      case 'cancelled': return 'text-gray-500 border-gray-200 bg-gray-100';
      default: return 'text-slate-600 border-slate-200 bg-slate-50';
    }
  };

  const filteredInvoices = invoices?.filter(inv => 
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
    inv.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Invoices</h2>
          <p className="text-muted-foreground">Manage billing and payments.</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
          <div className="flex items-center gap-2 w-full max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by invoice # or client..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredInvoices && filteredInvoices.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <Link href={`/invoices/${invoice.id}`} className="hover:underline hover:text-primary">
                          {invoice.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{invoice.clientName}</TableCell>
                      <TableCell className="font-medium text-right sm:text-left">${invoice.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                      <TableCell>{format(new Date(invoice.issueDate), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(invoice.status)}>
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link href={`/invoices/${invoice.id}`} className="cursor-pointer flex items-center">
                                <Printer className="mr-2 h-4 w-4" /> View / Print
                              </Link>
                            </DropdownMenuItem>
                            {isAdmin && (
                              <>
                                <DropdownMenuItem onClick={() => openEdit(invoice)}>Edit Invoice</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleStatusChange(invoice.id, 'sent')}>Mark Sent</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(invoice.id, 'paid')}>Mark Paid</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDelete(invoice.id)}>
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 border rounded-lg border-dashed">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-medium">No invoices found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all' ? "No results match your filters." : "You haven't created any invoices yet."}
              </p>
              {isAdmin && !searchTerm && statusFilter === 'all' && (
                <Button onClick={openCreate} variant="outline">Create First Invoice</Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editInvoiceId ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
            <DialogDescription>
              {editInvoiceId ? "Update invoice details." : "Create a new invoice for a client."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 px-1">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="clientId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client *</FormLabel>
                    <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value ? field.value.toString() : ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {clientList?.map(client => (
                          <SelectItem key={client.id} value={client.id.toString()}>{client.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="issueDate" render={({ field }) => (
                  <FormItem><FormLabel>Issue Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="pt-4 border-t mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">Line Items</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}>
                    <PlusCircle className="h-4 w-4 mr-2" /> Add Item
                  </Button>
                </div>
                
                <div className="space-y-3 mt-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-start gap-2 relative">
                      <FormField control={form.control} name={`items.${index}.description`} render={({ field }) => (
                        <FormItem className="flex-1"><FormControl><Input placeholder="Description" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                        <FormItem className="w-24"><FormControl><Input type="number" min="1" step="any" placeholder="Qty" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field }) => (
                        <FormItem className="w-32"><FormControl><Input type="number" min="0" step="0.01" placeholder="Price" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => remove(index)} disabled={fields.length === 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Notes / Terms</FormLabel><FormControl><Textarea placeholder="Thank you for your business..." className="resize-none h-24" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>${subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <FormField control={form.control} name="tax" render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4 space-y-0">
                      <FormLabel className="text-sm font-normal text-muted-foreground">Tax (%)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="100" step="0.1" className="w-24 text-right" {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax Amount:</span>
                    <span>${taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total:</span>
                    <span>${total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-4 mt-4 border-t sticky bottom-0 bg-background pb-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createInvoice.isPending || updateInvoice.isPending}>
                  {createInvoice.isPending || updateInvoice.isPending ? "Saving..." : "Save Invoice"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}