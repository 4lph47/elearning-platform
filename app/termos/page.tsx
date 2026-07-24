import Link from "next/link";

export const metadata = { title: "Termos e Serviços — E-Learn" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Termos e Serviços</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Última atualização: 2026-07-24</p>

      <div className="prose prose-slate mt-8 max-w-none space-y-6 text-sm leading-relaxed text-slate-700 dark:prose-invert dark:text-slate-300">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">1. A conta</h2>
          <p>
            Ao criar conta confirmas que a informação fornecida (nome, email, e no caso de instrutores, experiência e
            especialização) é verdadeira. És responsável por manter a tua password em segurança.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">2. Contas de instrutor</h2>
          <p>
            Ao pedires uma conta de instrutor autorizas a publicação dos dados de perfil (bio, especialização, anos de
            experiência, certificações e redes sociais) na tua página pública e nos cursos que criares. Reservamo-nos
            o direito de rever ou suspender contas de instrutor que violem estes termos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">3. Conteúdo e cursos</h2>
          <p>
            Instrutores mantêm os direitos sobre o conteúdo que publicam, mas concedem à plataforma licença para o
            distribuir aos alunos inscritos. Conteúdo que infrinja direitos de autor ou seja enganoso pode ser
            removido sem aviso prévio.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">4. Pagamentos</h2>
          <p>
            Compras de cursos são processadas através do gateway de pagamento integrado. Reembolsos seguem a política
            apresentada no momento da compra.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">5. Privacidade</h2>
          <p>
            O tratamento dos teus dados pessoais está descrito na{" "}
            <Link href="/privacidade" className="text-blue-500 hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">6. Contacto</h2>
          <p>Dúvidas sobre estes termos: suporte@e-learn.example</p>
        </section>
      </div>
    </div>
  );
}
