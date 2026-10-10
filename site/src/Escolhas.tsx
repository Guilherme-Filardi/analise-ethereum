/** Botões de escolha (um só fica marcado). Botões de verdade, com o estado para leitor de tela. */
export function Escolhas<T extends string | number>({ opcoes, atual, mudar, rotulo }: {
  opcoes: { id: T; nome: string }[]
  atual: T | null
  mudar: (id: T) => void
  rotulo: string
}) {
  return (
    <div className="escolhas" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={String(o.id)} type="button" aria-pressed={o.id === atual} onClick={() => mudar(o.id)}>
          {o.nome}
        </button>
      ))}
    </div>
  )
}
