import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { withScreen } from "@/stores/screenStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  email: z.string().trim().min(2, { message: "Enter your email or username" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
});

export default function Login() {
  const navigate = useNavigate();
  const { login, isSubmitting, error } = useAuthStore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await withScreen("Getting things ready", () => login(values.email, values.password), 1500);
      navigate(useAuthStore.getState().user?.role === "admin" ? "/admin" : "/home");
    } catch {
      // Error is already stored in the auth store.
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
        <p className="text-muted-foreground text-sm">
          Enter your credentials to login.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email or username</FormLabel>
                <FormControl>
                  <Input placeholder="you@example.com" autoCapitalize="none" autoCorrect="off" {...field} />
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
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full mt-6" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Form>

      <div className="mt-6 text-center text-sm">
        <span className="text-muted-foreground">Don't have an account? </span>
        <Link
          to="/register"
          className="font-medium text-primary hover:underline"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
