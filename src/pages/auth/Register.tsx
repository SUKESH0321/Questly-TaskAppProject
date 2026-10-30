import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { withScreen } from "@/stores/screenStore";
import { LocationField } from "@/components/shared/LocationField";
import { AadhaarUpload } from "@/components/shared/AadhaarUpload";
import { aadhaarReady, useAadhaarDraft } from "@/stores/aadhaarDraft";
import { useState } from "react";
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
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  phone: z.string().refine(
    (v) => {
      // Accepts 9876543210, +91 98765 43210, 09876543210 (Indian mobile numbers).
      let d = v.replace(/\D/g, "");
      if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
      if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
      return /^[6-9]\d{9}$/.test(d);
    },
    { message: "Enter a valid 10-digit mobile number" },
  ),
  location: z.string().max(200).optional(),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
});

export default function Register() {
  const navigate = useNavigate();
  const { register, isSubmitting, error } = useAuthStore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      location: "",
      password: "",
    },
  });

  const aadhaar = useAadhaarDraft();
  const [aadhaarError, setAadhaarError] = useState(false);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Aadhaar photo + consent (or "later") is part of creating the account.
    if (!aadhaarReady(aadhaar)) {
      setAadhaarError(true);
      return;
    }
    setAadhaarError(false);
    try {
      await withScreen(
        "Creating your account",
        async () => {
          await register(values.name, values.email, values.password, values.phone);
          // Save the address picked on the map; a failure here must not block sign-up.
          const location = values.location?.trim();
          if (location) await useAuthStore.getState().updateUser({ location }).catch(() => {});
        },
        1800,
      );
      // Next: confirm the mobile number with an SMS code.
      navigate("/verify-phone");
    } catch {
      // Error is already stored in the auth store.
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Create an account</h2>
        <p className="text-muted-foreground text-sm">
          Join Questly and start doing tasks.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="you@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile number</FormLabel>
                <FormControl>
                  <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" {...field} />
                </FormControl>
                <p className="text-xs text-muted-foreground">We'll text you a code to verify it. Indian mobile numbers.</p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your address <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                <FormControl>
                  <LocationField value={field.value ?? ""} onChange={field.onChange} height={200} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Verify with Aadhaar</p>
            <p className="text-xs text-muted-foreground">Upload a clear photo of your Aadhaar card. Verified accounts earn a trust badge.</p>
            <AadhaarUpload />
            {aadhaarError && !aadhaarReady(aadhaar) && (
              <p role="alert" className="text-sm font-medium text-destructive">
                Upload your Aadhaar card and tick the consent box, or choose "I'll do this later".
              </p>
            )}
          </div>
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
            {isSubmitting ? "Creating account..." : "Sign up"}
          </Button>
        </form>
      </Form>

      <div className="mt-6 text-center text-sm">
        <span className="text-muted-foreground">Already have an account? </span>
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
