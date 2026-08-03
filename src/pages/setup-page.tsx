import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const environmentSchema = z.object({
  environmentName: z.string().trim().min(1, "環境名を入力してください"),
});

type EnvironmentForm = z.infer<typeof environmentSchema>;

export function SetupPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitSuccessful },
  } = useForm<EnvironmentForm>({
    resolver: zodResolver(environmentSchema),
    defaultValues: { environmentName: "Local" },
  });

  const confirmEnvironment = () => undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <CheckCircle2
            aria-hidden="true"
            className="mx-auto size-12 text-primary"
          />
          <CardTitle className="text-3xl">Candidate CRM</CardTitle>
          <CardDescription className="text-base">
            開発環境のセットアップが完了しました
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={(event) => {
            void handleSubmit(confirmEnvironment)(event);
          }}
        >
          <CardContent className="space-y-2">
            <label className="text-sm font-medium" htmlFor="environmentName">
              環境名
            </label>
            <Input id="environmentName" {...register("environmentName")} />
            {errors.environmentName ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.environmentName.message}
              </p>
            ) : null}
            {isSubmitSuccessful ? (
              <p className="text-sm text-primary" role="status">
                開発環境を確認しました
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="pt-6">
            <Button className="w-full" type="submit">
              セットアップを確認
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
