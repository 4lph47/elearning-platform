"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, CreditCard, ShieldCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Method = "mpesa" | "emola" | "mkesh" | "card";

const METHODS: { id: Method; label: string; sub: string; mobile: boolean }[] = [
  { id: "mpesa", label: "M-Pesa", sub: "Vodacom", mobile: true },
  { id: "emola", label: "e-Mola", sub: "Movitel", mobile: true },
  { id: "mkesh", label: "mKesh", sub: "Tmcel", mobile: true },
  { id: "card", label: "Cartão bancário", sub: "Visa · Mastercard", mobile: false },
];

function randomReference() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MZ-${part()}-${part()}`;
}

export function CheckoutForm({
  items,
  firstLessonHref,
}: {
  items: { id: string; title: string; price: number }[];
  firstLessonHref: string;
}) {
  const price = items.reduce((sum, item) => sum + item.price, 0);
  const router = useRouter();
  const [method, setMethod] = useState<Method>("mpesa");
  const [phone, setPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reference: string } | null>(null);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const selected = METHODS.find((m) => m.id === method)!;
    if (selected.mobile && phone.replace(/\D/g, "").length < 9) {
      setError("Introduz um número de telemóvel válido");
      return;
    }
    if (!selected.mobile && cardNumber.replace(/\D/g, "").length < 12) {
      setError("Introduz um número de cartão válido");
      return;
    }

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const res = await fetch("/api/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseIds: items.map((item) => item.id) }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao processar pagamento");
      return;
    }

    setResult({ reference: randomReference() });
  }

  if (result) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-950 p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-600">
          <Check size={26} className="text-white" />
        </span>
        <h2 className="mt-4 text-xl font-bold text-white">Pagamento confirmado</h2>
        <p className="mt-1 text-sm text-slate-400">Já tens acesso ao curso. Bons estudos!</p>

        <dl className="mx-auto mt-6 max-w-xs space-y-1.5 rounded-lg border border-white/10 bg-white/5 p-4 text-left text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-400">Referência</dt>
            <dd className="font-medium text-slate-100">{result.reference}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Método</dt>
            <dd className="font-medium text-slate-100">{METHODS.find((m) => m.id === method)!.label}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Valor</dt>
            <dd className="font-semibold text-blue-400">{price.toFixed(2)}€</dd>
          </div>
        </dl>

        <Button
          onClick={() => {
            router.push(firstLessonHref);
            router.refresh();
          }}
          variant="accent"
          className="mt-6 w-full"
        >
          Começar a aprender
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={confirm} className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Escolha o método de pagamento
        </p>
        <div className="space-y-2">
          {METHODS.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${
                method === m.id ? "border-blue-500 bg-blue-600/10" : "border-white/10 hover:bg-white/5"
              }`}
            >
              <input
                type="radio"
                name="method"
                checked={method === m.id}
                onChange={() => setMethod(m.id)}
                className="accent-blue-600"
              />
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300">
                {m.mobile ? <Smartphone size={15} /> : <CreditCard size={15} />}
              </span>
              <span>
                <span className="block text-sm font-medium text-slate-100">{m.label}</span>
                <span className="block text-xs text-slate-500">{m.sub}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {METHODS.find((m) => m.id === method)!.mobile ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Número {METHODS.find((m) => m.id === method)!.label}</label>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
            <span className="text-sm text-slate-400">+258</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="84 123 4567"
              className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Vais receber um pedido de confirmação no teu telemóvel.</p>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Número do cartão</label>
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            placeholder="0000 0000 0000 0000"
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-4 py-3">
        <span className="text-sm text-slate-300">Total a pagar</span>
        <span className="text-lg font-bold text-white">{price.toFixed(2)}€</span>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" variant="accent" disabled={loading} className="w-full">
        {loading ? "A processar..." : `Confirmar pagamento`}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
        <ShieldCheck size={13} /> Pagamento simulado — ambiente de demonstração, nenhum valor é cobrado
      </p>
    </form>
  );
}
