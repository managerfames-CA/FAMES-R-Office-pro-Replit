import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLogin, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useFirmBranding } from "@/hooks/use-firm-branding";
import { FirmLogo } from "@/components/FirmLogo";
import { useEffect } from "react";
import { ShieldCheck, Sparkles, Briefcase } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export default function Login() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { name: firmName, tagline, logoUrl } = useFirmBranding();

  const login = useLogin();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (isAuthenticated) setLocation("/");
  }, [isAuthenticated, setLocation]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await login.mutateAsync({ data: values });
      await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast.success("Welcome back");
      setLocation("/");
    } catch {
      toast.error("Invalid email or password");
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-primary via-primary to-emerald-600 text-primary-foreground">
        <div className="flex items-center gap-3">
          <FirmLogo name={firmName} logoUrl={logoUrl} size="md" className="!bg-white/15 !text-white" />
          <div>
            <div className="text-lg font-semibold leading-tight">{firmName}</div>
            <div className="text-xs text-white/70">{tagline}</div>
          </div>
        </div>
        <div className="space-y-6 max-w-md">
          <h2 className="text-3xl font-bold leading-tight">
            Manage your office.<br />
            Empower your team.
          </h2>
          <p className="text-white/80">
            One workspace for tasks, attendance, work logs, clients and reporting — built for fast-moving small businesses.
          </p>
          <div className="space-y-3 pt-2">
            <FeatureRow icon={ShieldCheck} title="Secure" desc="Role-based access keeps data right where it belongs." />
            <FeatureRow icon={Sparkles} title="Smart" desc="Approvals, alerts and dashboards in one place." />
            <FeatureRow icon={Briefcase} title="Professional" desc="Branded for your firm — clean, focused, fast." />
          </div>
        </div>
        <div className="text-xs text-white/60">© {new Date().getFullYear()} {firmName}. All rights reserved.</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md shadow-lg border-muted">
          <CardHeader className="space-y-3 text-center pb-6">
            <div className="flex justify-center mb-1 lg:hidden">
              <FirmLogo name={firmName} logoUrl={logoUrl} size="lg" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">{firmName}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {tagline}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="you@yourfirm.com" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  <p className="font-medium mb-1 text-foreground">Demo Sign-in</p>
                  <div className="grid grid-cols-[1fr_2fr] gap-x-2 gap-y-1">
                    <span>Admin:</span>
                    <span className="font-mono text-xs">admin@office.app / admin123</span>
                    <span>Staff:</span>
                    <span className="font-mono text-xs">alex@office.app / staff123</span>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={login.isPending}>
                  {login.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureRow({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 h-9 w-9 rounded-lg bg-white/15 flex items-center justify-center">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-white/80">{desc}</div>
      </div>
    </div>
  );
}
