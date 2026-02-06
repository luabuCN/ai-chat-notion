import Form from "next/form";

import { Input } from "@repo/ui";
import { Label } from "@repo/ui";

export function AuthForm({
  action,
  children,
  defaultEmail = "",
  showName = false,
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
  showName?: boolean;
}) {
  return (
    <Form action={action} className="flex flex-col gap-4 px-4 sm:px-16">
      {showName && (
        <div className="flex flex-col gap-2">
          <Label
            className="font-normal text-zinc-600 dark:text-zinc-400"
            htmlFor="name"
          >
            Username
          </Label>

          <Input
            autoComplete="name"
            autoFocus
            className="bg-muted text-md md:text-sm transition-all focus-visible:ring-primary/20 focus-visible:border-primary"
            id="name"
            name="name"
            placeholder="johndoe"
            required
            type="text"
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label
          className="font-normal text-zinc-600 dark:text-zinc-400"
          htmlFor="email"
        >
          {showName ? "Email Address" : "Username or Email"}
        </Label>

        <Input
          autoComplete="email"
          autoFocus={!showName}
          className="bg-muted text-md md:text-sm transition-all focus-visible:ring-primary/20 focus-visible:border-primary"
          defaultValue={defaultEmail}
          id="email"
          name="email"
          placeholder={showName ? "user@example.com" : "Email or username"}
          required
          type={showName ? "email" : "text"}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label
          className="font-normal text-zinc-600 dark:text-zinc-400"
          htmlFor="password"
        >
          Password
        </Label>

        <Input
          className="bg-muted text-md md:text-sm transition-all focus-visible:ring-primary/20 focus-visible:border-primary"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>

      {children}
    </Form>
  );
}
