/**
 * Botões de escolha (um só fica marcado). Botões de verdade, com o estado para leitor de tela.
 * `chips` são pílulas soltas (períodos, valores); `segmento` é a barra de opções colada
 * (tipo de gráfico, escala). Opção com `desligada` aparece, mas não se clica.
 */
export function Escolhas<T extends string | number>({ opcoes, atual, mudar, rotulo, estilo = 'chips' }: {
  opcoes: { id: T; nome: string; desligada?: boolean; dica?: string }[]
  atual: T | null
  mudar: (id: T) => void
  rotulo: string
  estilo?: 'chips' | 'segmento'
}) {
  return (
    <div className={estilo === 'segmento' ? 'segmento' : 'escolhas'} role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={String(o.id)} type="button" aria-pressed={o.id === atual} disabled={o.desligada}
          title={o.dica} onClick={() => mudar(o.id)}>
          {o.nome}
        </button>
      ))}
    </div>
  )
}
