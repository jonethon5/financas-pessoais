import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CaretDown, ChatCircleText, MagnifyingGlass } from '@phosphor-icons/react'
import { Pig } from '../components/Pig'
import { BackButton, NavBar } from '../components/ui'
import { HELP, searchHelp, type HelpItem } from '../lib/help'
import { MASCOT_NAME } from '../brand'

/** /ajuda: central de ajuda com busca e perguntas por assunto. */
export function HelpPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const hits = searchHelp(query)
  const searching = query.trim().length > 1

  return (
    <>
      <NavBar title="Ajuda" left={<BackButton onClick={() => navigate(-1)} />} help={false} />
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Pig art="rosto-pensativo" px={64} still />
          <p className="leading-snug text-muted">
            Tem dúvida? Busque abaixo ou escolha um assunto. O {MASCOT_NAME} explica.
          </p>
        </div>
        <label className="shadow-soft flex items-center gap-2.5 rounded-full bg-surface px-4 py-3">
          <MagnifyingGlass size={20} className="shrink-0 text-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex.: renda, extrato, conectar banco" aria-label="Buscar na ajuda" autoComplete="off" className="min-w-0 flex-1 bg-transparent text-[1rem] outline-none placeholder:text-muted" />
        </label>

        {searching ? (
          hits.length ? (
            <section className="shadow-soft overflow-hidden rounded-[1.25rem] bg-surface">
              {hits.map(({ item }) => (
                <Question key={item.q} item={item} open />
              ))}
            </section>
          ) : (
            <p className="px-1 text-muted">Nada encontrado para “{query}”. Tente outra palavra ou mande sua dúvida para a gente.</p>
          )
        ) : (
          <>
            <nav aria-label="Assuntos" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {HELP.map((g) => (
                <a key={g.id} href={`#ajuda-${g.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`ajuda-${g.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} className="shadow-soft shrink-0 rounded-full bg-surface px-3.5 py-2 text-[0.875rem] font-semibold whitespace-nowrap">
                  {g.title}
                </a>
              ))}
            </nav>
            {HELP.map((g) => (
              <section key={g.id} id={`ajuda-${g.id}`} className="scroll-mt-20">
                <h2 className="mb-1.5 px-4 text-[0.8125rem] font-medium tracking-wide text-muted uppercase">{g.title}</h2>
                <div className="shadow-soft overflow-hidden rounded-[1.25rem] bg-surface">
                  {g.items.map((item) => (
                    <Question key={item.q} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}

        <Link to="/voce/sugestao" className="press flex items-center gap-3 rounded-[1.25rem] bg-primary-soft p-4">
          <ChatCircleText size={28} weight="duotone" className="shrink-0 text-primary-strong" />
          <span className="flex-1 leading-snug">
            <strong>Não achou?</strong> Mande sua dúvida. Lemos todas as mensagens.
          </span>
        </Link>
      </div>
    </>
  )
}

function Question({ item, open = false }: { item: HelpItem; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-line last:border-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 font-semibold [&::-webkit-details-marker]:hidden">
        <span className="flex-1 leading-snug">{item.q}</span>
        <CaretDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="px-4 pb-4 text-[0.9375rem] leading-relaxed text-muted">
        <p>{item.a}</p>
        {item.to && (
          <Link to={item.to.path} className="mt-2 inline-block font-semibold text-primary">
            {item.to.label} ›
          </Link>
        )}
      </div>
    </details>
  )
}
