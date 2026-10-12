import { useCallback, useEffect, useState } from 'react'
import { pedir, type AoVivo } from './api'

/**
 * Pede um endereço e guarda a resposta, o erro e se está buscando. Quando o endereço muda
 * (outro período, outra escala), a resposta anterior fica na tela até a nova chegar, com
 * `atualizando` ligado: o gráfico não some nem pula. `endereco` nulo não pede nada.
 */
export function useDado<T>(endereco: string | null) {
  const [dado, setDado] = useState<T | null>(null)
  const [de, setDe] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [vez, setVez] = useState(0)

  useEffect(() => {
    if (!endereco) return
    let valido = true
    setErro(null)
    pedir<T>(endereco)
      .then((r) => { if (valido) { setDado(r); setDe(endereco) } })
      .catch((e: Error) => { if (valido) setErro(e.message) })
    return () => { valido = false }
  }, [endereco, vez])

  const recarregar = useCallback(() => setVez((v) => v + 1), [])
  // `de` é o endereço que produziu o `dado` na tela (pode ser o anterior, enquanto o novo chega).
  return { dado, de, erro, recarregar, atualizando: endereco !== null && de !== endereco && !erro }
}

/** O preço de agora, pedido de novo a cada minuto enquanto a tela estiver aberta. */
export function useAoVivo(ligado = true) {
  const r = useDado<AoVivo>(ligado ? '/api/agora' : null)
  const { recarregar } = r
  useEffect(() => {
    if (!ligado) return
    const relogio = setInterval(recarregar, 60_000)
    return () => clearInterval(relogio)
  }, [ligado, recarregar])
  return r
}
