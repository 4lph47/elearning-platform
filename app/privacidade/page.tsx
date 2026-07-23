import Link from "next/link";

export const metadata = { title: "Política de Privacidade — E-Learn" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Política de Privacidade</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Última atualização: 2026-07-23</p>

      <div className="prose prose-slate mt-8 max-w-none space-y-6 text-sm leading-relaxed text-slate-700 dark:prose-invert dark:text-slate-300">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">1. Dados que recolhemos</h2>
          <p>
            Nome, email e password (encriptada) quando crias conta; dados de perfil que preenches voluntariamente
            (bio, redes sociais, certificações); progresso nos cursos (aulas vistas, respostas a quizzes,
            comentários, avaliações); dados de inscrição e faturação quando compras um curso.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">2. Como usamos os dados</h2>
          <p>
            Para dar acesso aos cursos em que te inscreves, guardar o teu progresso, mostrar os teus comentários e
            avaliações a outros utilizadores, e comunicar contigo sobre a tua conta. Não vendemos os teus dados a
            terceiros.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">3. Cookies</h2>
          <p>
            Usamos apenas um cookie essencial de sessão (autenticação) — necessário para manteres a sessão iniciada.
            Não usamos cookies de publicidade nem de tracking de terceiros.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">4. Os teus direitos (RGPD)</h2>
          <p>
            Podes aceder, exportar ou eliminar os teus dados a qualquer momento na página{" "}
            <Link href="/account" className="text-blue-500 hover:underline">
              A minha conta
            </Link>
            . Para pedidos que não consigas resolver aí (ex: transferência de cursos de instrutor), contacta-nos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">5. Contacto</h2>
          <p>Dúvidas sobre privacidade: suporte@e-learn.example</p>
        </section>
      </div>
    </div>
  );
}
