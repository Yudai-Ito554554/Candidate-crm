declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  resolveDns(
    query: string,
    recordType: "A" | "AAAA",
    options?: { signal?: AbortSignal },
  ): Promise<string[]>;
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
