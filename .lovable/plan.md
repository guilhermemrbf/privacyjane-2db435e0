# Instruções Pix dentro do pagamento atual

## Objetivo
Melhorar exclusivamente o estado exibido após a geração do Pix na página existente `upsell01.html`, sem criar outra página, alterar sua identidade ou duplicar a integração.

## Alterações
- Manter o modal e seus estados atuais: gerando, Pix gerado, aguardando confirmação, confirmado e erro.
- Expandir o estado “Pix gerado” com o título e subtítulo solicitados, preservando cores, fonte, bordas, espaçamentos, largura e botões já usados pela página.
- Exibir o QR Code dinâmico criado a partir do `copyPaste` retornado pela API atual e manter o código real da transação visível e copiável.
- Organizar quatro passos numerados: copiar/escanear, abrir o banco, selecionar Pix Copia e Cola e conferir/confirmar.
- Adicionar um aviso para conferência dos dados e um bloco curto de segurança, sem orientar a ignorar alertas bancários.
- Manter o feedback acessível do botão de cópia e melhorar sua leitura por tecnologias assistivas.
- Manter o polling existente como única verificação automática; não criar consultas paralelas nem marcar pagamento como confirmado antes do retorno `COMPLETO`.
- Preservar o fechamento do modal como retorno à etapa pendente, sem liberar o acesso.

## Ajuste de segurança relacionado ao valor
- Fixar no servidor o valor de `UPSELL 01` em R$ 13,99, para que o navegador não consiga alterar essa cobrança.
- Preservar os demais planos e o contrato atual da API.

## Validação
- Testar desktop e celular com resposta Pix simulada somente no navegador, confirmando layout, QR dinâmico, botão copiar, ausência de rolagem horizontal e estado aguardando.
- Testar os estados de geração e erro sem criar cobrança real.
- Confirmar que a rotina atual continua consultando a mesma transação e que apenas `COMPLETO` segue para a liberação.
