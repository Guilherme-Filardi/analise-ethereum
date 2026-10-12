// Ícones desenhados em linha (SVG), no traço de 2 px, para não trazer biblioteca nova.
// Sempre acompanham um texto: sozinhos, ficam escondidos do leitor de tela (aria-hidden).

const caminhos = {
  painel: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  previsao: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  simular: 'M4 4h16v16H4zM8 8h8M8 12h2M14 12h2M8 16h2M14 16h2',
  estudo: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  estatistica: 'M3 20h18M5 20c2.5 0 3.5-14 7-14s4.5 14 7 14M12 6v14',
  historico: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3',
  sol: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  lua: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  atualizar: 'M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M3 21v-5h5',
  seta: 'M5 12h14M13 6l6 6-6 6',
  sobe: 'M12 19V5M5 12l7-7 7 7',
  cai: 'M12 5v14M19 12l-7 7-7-7',
  eth: 'M12 2l6.5 10.5L12 16l-6.5-3.5zM5.5 14L12 22l6.5-8L12 17.5z',
} as const

export type NomeIcone = keyof typeof caminhos

export function Icone({ nome }: { nome: NomeIcone }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={caminhos[nome]} />
    </svg>
  )
}
