import { useEffect, useState } from 'react'
import { Abas } from './Abas'
import { Diario } from './telas/Diario'
import { Guia } from './telas/Guia'
import { Hoje } from './telas/Hoje'
import { Preco } from './telas/Preco'
import { Simular } from './telas/Simular'

type Tela = 'preco' | 'palpite' | 'simular' | 'estudo' | 'historico'

const TELAS: { id: Tela; nome: string }[] = [
  { id: 'preco', nome: 'Preço' },
  { id: 'palpite', nome: 'Palpite do dia' },
  { id: 'simular', nome: 'Simular' },
  { id: 'estudo', nome: 'O que o estudo mostra' },
  { id: 'historico', nome: 'Histórico de palpites' },
]

// A tela aberta fica no endereço (#simular), para o "voltar" do navegador e o F5 funcionarem.
function telaDoEndereco(): Tela {
  const pedida = window.location.hash.slice(1)
  return TELAS.some((t) => t.id === pedida) ? (pedida as Tela) : 'preco'
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
        <p>O preço do ETH (a moeda do Ethereum), com dado público. É um estudo: nada aqui é recomendação de compra.</p>
        <Abas opcoes={TELAS} atual={tela} mudar={(id) => { window.location.hash = id }} rotulo="Telas" />
      </header>
      <main>
        {tela === 'preco' && <Preco />}
        {tela === 'palpite' && <Hoje />}
        {tela === 'simular' && <Simular />}
        {tela === 'estudo' && <Guia />}
        {tela === 'historico' && <Diario />}
      </main>
    </>
  )
}
