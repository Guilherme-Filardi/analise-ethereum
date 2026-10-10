/** Fileira de abas com botões de verdade: teclado, foco e o estado marcado para leitor de tela. */
export function Abas<T extends string>({ opcoes, atual, mudar, rotulo, pequenas = false }: {
  opcoes: { id: T; nome: string }[]
  atual: T
  mudar: (id: T) => void
  rotulo: string
  pequenas?: boolean
}) {
  return (
    <div className={pequenas ? 'abas pequenas' : 'abas'} role="tablist" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.id} role="tab" aria-selected={o.id === atual} onClick={() => mudar(o.id)}>
          {o.nome}
        </button>
      ))}
    </div>
  )
}
