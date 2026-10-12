import { useEffect, useState } from 'react'
import { Icone, type NomeIcone } from './Icones'
import { Diario } from './telas/Diario'
import { Guia } from './telas/Guia'
import { Hoje } from './telas/Hoje'
import { Painel } from './telas/Painel'
import { Simular } from './telas/Simular'

export type Tela = 'painel' | 'previsao' | 'simular' | 'estudo' | 'historico'

const TELAS: { id: Tela; nome: string; curto: string; icone: NomeIcone }[] = [
  { id: 'painel', nome: 'Painel', curto: 'Painel', icone: 'painel' },
  { id: 'previsao', nome: 'Previsão', curto: 'Previsão', icone: 'previsao' },
  { id: 'simular', nome: 'Simular', curto: 'Simular', icone: 'simular' },
  { id: 'estudo', nome: 'O que o estudo mostra', curto: 'Estudo', icone: 'estudo' },
  { id: 'historico', nome: 'Histórico', curto: 'Histórico', icone: 'historico' },
]

// Endereços antigos (#preco, #palpite) continuam abrindo a tela certa.
const APELIDOS: Record<string, Tela> = { preco: 'painel', palpite: 'previsao' }

// A tela aberta fica no endereço (#simular), para o "voltar" do navegador e o F5 funcionarem.
function telaDoEndereco(): Tela {
  const pedida = window.location.hash.slice(1)
  if (pedida in APELIDOS) return APELIDOS[pedida]
  return TELAS.some((t) => t.id === pedida) ? (pedida as Tela) : 'painel'
}

export function irPara(tela: Tela) {
  window.location.hash = tela
  window.scrollTo({ top: 0 })
}

type Tema = 'claro' | 'escuro'

// O tema escolhido fica guardado só neste navegador. Sem escolha, vale o do aparelho.
function temaGuardado(): Tema | null {
  try {
    const t = localStorage.getItem('tema')
    return t === 'claro' || t === 'escuro' ? t : null
  } catch {
    return null
  }
}

function temaDoAparelho(): Tema {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
}

function BotaoTema({ tema, trocar }: { tema: Tema; trocar: () => void }) {
  const outro = tema === 'escuro' ? 'claro' : 'escuro'
  return (
    <button className="botao-icone" onClick={trocar} aria-label={`Mudar para o tema ${outro}`} title={`Tema ${outro}`}>
      <Icone nome={tema === 'escuro' ? 'sol' : 'lua'} />
      <span className="rotulo-tema">Tema {outro}</span>
    </button>
  )
}

function Marca() {
  return (
    <div className="marca">
      <div className="logo"><Icone nome="eth" /></div>
      <div>
        <strong>Análise Ethereum</strong>
        <span>ETH em dólar · dado público</span>
      </div>
    </div>
  )
}

export function App() {
  const [tela, setTela] = useState<Tela>(telaDoEndereco)
  const [tema, setTema] = useState<Tema>(() => {
    const t = temaGuardado() ?? temaDoAparelho()
    document.documentElement.dataset.tema = t
    return t
  })

  useEffect(() => {
    const aoMudar = () => setTela(telaDoEndereco())
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])

  useEffect(() => {
    document.title = `${TELAS.find((t) => t.id === tela)!.nome} · Análise Ethereum`
  }, [tela])

  function trocarTema() {
    const novo = tema === 'escuro' ? 'claro' : 'escuro'
    // Antes de redesenhar: os gráficos leem as cores da página na hora de desenhar.
    document.documentElement.dataset.tema = novo
    setTema(novo)
    try { localStorage.setItem('tema', novo) } catch { /* sem armazenamento: vale só nesta visita */ }
  }

  return (
    <div className="casca">
      <aside className="menu">
        <Marca />
        <nav aria-label="Telas">
          {TELAS.map((t) => (
            <button key={t.id} aria-current={t.id === tela ? 'page' : undefined} onClick={() => irPara(t.id)}>
              <Icone nome={t.icone} />
              <span className="nome-longo">{t.nome}</span>
              <span className="nome-curto">{t.curto}</span>
            </button>
          ))}
        </nav>
        <div className="rodape-menu">
          <BotaoTema tema={tema} trocar={trocarTema} />
          <p className="aviso-rodape">Projeto de estudo e análise de dados. Nada aqui é recomendação de compra.</p>
        </div>
      </aside>

      <header className="topo-celular">
        <Marca />
        <BotaoTema tema={tema} trocar={trocarTema} />
      </header>

      <main className="conteudo">
        <div className="largura">
          {tela === 'painel' && <Painel />}
          {tela === 'previsao' && <Hoje />}
          {tela === 'simular' && <Simular />}
          {tela === 'estudo' && <Guia />}
          {tela === 'historico' && <Diario />}
        </div>
      </main>
    </div>
  )
}
