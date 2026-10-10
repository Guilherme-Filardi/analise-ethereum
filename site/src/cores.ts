// As cores dos gráficos vêm das variáveis do estilo.css, para o modo escuro valer também
// dentro do gráfico (o Recharts recebe a cor pronta, não a variável).
export function cor(nome: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
}
