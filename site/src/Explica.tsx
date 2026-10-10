import type { ReactNode } from 'react'

/** Um "O que é isso?" que abre ao clicar, com a explicação em linguagem simples. */
export function Explica({ titulo = 'O que é isso?', children }: { titulo?: string; children: ReactNode }) {
  return (
    <details className="explica">
      <summary>{titulo}</summary>
      <div>{children}</div>
    </details>
  )
}
