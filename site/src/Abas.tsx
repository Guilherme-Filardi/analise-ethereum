/** Fileira de abas com botões de verdade: teclado, foco e o estado marcado para leitor de tela. */
export function Abas<T extends string>({ opcoes, atual, mudar, rotulo }: {
  opcoes: { id: T; nome: string }[]
  atual: T
  mudar: (id: T) => void
  rotulo: string
}) {
  return (
    <div className="segmento abas" role="tablist" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={o.id === atual} onClick={() => mudar(o.id)}>
          {o.nome}
        </button>
      ))}
    </div>
  )
}
