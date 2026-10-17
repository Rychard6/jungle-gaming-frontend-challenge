import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { HomeSearch } from '../../../app/router'
import { buttonVariants } from '../../../shared/ui/button-variants'

const journalEntries = [
  {
    image: '/mock-assets/nfts/ape-ivory.png',
    date: '12 de setembro',
    readingTime: 'Leitura de 6 min',
    title: 'Como funciona a propriedade de NFTs',
    summary: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
  },
  {
    image: '/mock-assets/nfts/ape-emerald.png',
    date: '13 de setembro',
    readingTime: 'Leitura de 2 min',
    title: '10 artistas digitais para acompanhar',
    summary: 'Conheça criadores que moldam a cultura digital.',
  },
  {
    image: '/mock-assets/nfts/ape-cosmic.png',
    date: '15 de setembro',
    readingTime: 'Leitura de 3 min',
    title: 'Raridade, atributos e procedência',
    summary: 'Entenda raridade, procedência, direitos autorais e utilidade.',
  },
  {
    image: '/mock-assets/nfts/ape-golden.png',
    date: '15 de setembro',
    readingTime: 'Leitura de 2 min',
    title: 'Como proteger sua carteira',
    summary: 'Proteja sua carteira, seus ativos e sua identidade.',
  },
] as const

/**
 * Blocos editoriais da home. São conteúdo estático do layout: os artigos do diário não têm
 * página (fora do escopo) e o clique informa isso em vez de simular uma leitura.
 */
export function EditorialSections({ search }: { search: HomeSearch }) {
  const [notice, setNotice] = useState('')

  return (
    <>
      <section
        aria-label="Edições especiais"
        className="mt-16 grid gap-5 border-y border-kurio-border py-10 sm:grid-cols-2"
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-kurio-amber">Edições especiais</p>
          <h2 className="mt-3 text-xl font-bold text-kurio-text">Lançamentos gênesis de edição limitada</h2>
          <p className="mt-3 max-w-md text-xs leading-6 text-kurio-text-muted">
            Descubra as primeiras obras de coleções que estão moldando a próxima geração da arte digital.
          </p>
        </div>
        <div className="self-end sm:text-right">
          <Link
            to="/"
            search={{ ...search, tab: 'new', page: 1 }}
            hash="catalogo"
            className={buttonVariants({ variant: 'outline' })}
          >
            Explorar lançamentos <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section aria-label="Curadoria KURIO" className="grid gap-6 py-10 md:grid-cols-2 md:items-center">
        <img
          src="/mock-assets/nfts/ape-cosmic.png"
          alt="Arte digital cósmica selecionada pela KURIO"
          width={640}
          height={376}
          loading="lazy"
          className="aspect-[1.7] w-full rounded-xl object-cover"
        />
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-kurio-amber">Curadoria KURIO</p>
          <h2 className="mt-3 text-2xl font-bold text-kurio-text">Arte digital selecionada e muito mais</h2>
          <p className="mt-3 text-xs leading-6 text-kurio-text-muted">
            Uma seleção que aproxima colecionadores de artistas e novas expressões da cultura.
          </p>
          <Link
            to="/"
            search={{ ...search, categories: 'Arte digital', page: 1 }}
            hash="catalogo"
            className={buttonVariants({ variant: 'outline', className: 'mt-5' })}
          >
            Explorar arte digital <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="journal-title">
        <p className="text-[10px] uppercase tracking-[0.2em] text-kurio-amber">Notas do estúdio</p>
        <h2 id="journal-title" className="mt-3 text-xl font-bold text-kurio-text">Diário da Cunhagem</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {journalEntries.map((entry) => (
            <li key={entry.title} className="overflow-hidden rounded-xl border border-kurio-border bg-kurio-surface">
              <img
                src={entry.image}
                alt=""
                width={320}
                height={200}
                loading="lazy"
                className="aspect-[1.6] w-full object-cover"
              />
              <div className="p-4">
                <p className="text-[9px] text-kurio-text-muted">
                  {entry.date} | {entry.readingTime}
                </p>
                <h3 className="mt-2 text-sm font-bold text-kurio-text">{entry.title}</h3>
                <p className="mt-2 text-[10px] leading-5 text-kurio-text-muted">{entry.summary}</p>
                <button
                  type="button"
                  onClick={() => setNotice(`O artigo "${entry.title}" não faz parte do escopo desta demonstração.`)}
                  className="mt-3 text-[10px] font-semibold text-kurio-amber underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-kurio-amber"
                >
                  Ler mais <span aria-hidden="true">→</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p aria-live="polite" className="mt-4 min-h-4 text-[10px] text-kurio-amber">{notice}</p>
      </section>
    </>
  )
}
