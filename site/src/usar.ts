import { useCallback, useEffect, useState } from 'react'
import { pedir } from './api'

/** Pede um endereço ao abrir a tela e guarda a resposta, o erro e se ainda está carregando. */
export function useDado<T>(endereco: string) {
  const [dado, setDado] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(() => {
    setErro(null)
    pedir<T>(endereco).then(setDado).catch((e: Error) => setErro(e.message))
  }, [endereco])

  useEffect(recarregar, [recarregar])
  return { dado, erro, recarregar }
}
