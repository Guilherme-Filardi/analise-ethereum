import { useEffect, useState } from 'react'
import { Abas } from './Abas'
import { Diario } from './telas/Diario'
import { Guia } from './telas/Guia'
import { Hoje } from './telas/Hoje'
import { Simular } from './telas/Simular'

type Tela = 'hoje' | 'simular' | 'guia' | 'diario'

const TELAS: { id: Tela; nome: string }[] = [
  { id: 'hoje', nome: 'Hoje' },
  { id: 'simular', nome: 'Simular' },
  { id: 'guia', nome: 'Guia' },
  { id: 'diario', nome: 'Diário' },
]

// A tela aberta fica no endereço (#simular), para o "voltar" do navegador e o F5 funcionarem.
function telaDoEndereco(): Tela {
  const pedida = window.location.hash.slice(1)
  return TELAS.some((t) => t.id === pedida) ? (pedida as Tela) : 'hoje'
}

export function App() {
  const [tela, setTela] = useState<Tela>(telaDoEndereco)

  useEffect(() => {
    const aoMudar = () => setTela(telaDoEndereco())
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])

  return (
    <>
      <header className="topo">
        <h1>Análise Ethereum</h1>
        <p>Estudo com dado do passado. Não é recomendação de investimento.</p>
        <Abas opcoes={TELAS} atual={tela} mudar={(id) => { window.location.hash = id }} rotulo="Telas" />
      </header>
      <main>
        {tela === 'hoje' && <Hoje />}
        {tela === 'simular' && <Simular />}
        {tela === 'guia' && <Guia />}
        {tela === 'diario' && <Diario />}
      </main>
    </>
  )
}
