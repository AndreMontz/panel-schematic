# Painel · Mapa de fios

Aplicativo web para selecionar tags e destacar fios, bornes e conexões de um painel elétrico. Componentes posicionados com base nas fotos do painel; os percursos dos fios são esquemáticos.

## Recursos

- Busca por tag, componente ou borne.
- Destaque dos fios selecionados e das conexões associadas.
- Zoom, arraste e ampliação com dois dedos.
- Foto original e painel desenhado.
- Consulta dos 14 bornes do Omron G9SE-201.
- Exportação das tags, quantidades e conexões em CSV.
- 42 tags e 125 etiquetas mínimas identificadas ou confirmadas.

As interligações entre as saídas dos contatores são três linhas separadas: 2T1–2T1, 4T2–4T2 e 6T3–6T3. Os seis fios entre contatores não têm tag. Somente os fios do terceiro contator aos bornes finais têm U1, V1 e W1.

## Executar localmente

O projeto usa HTML, CSS e JavaScript, sem dependências de instalação.

```bash
node check.mjs
python3 -m http.server 8000 --directory dist
```

Abra `http://localhost:8000`. Para compartilhar uma seleção, use `?tag=W018` na URL.

## Publicar no GitHub Pages

O arquivo `.github/workflows/pages.yml` verifica as conexões e publica o conteúdo de `dist` a cada push em `main`.

1. Envie este projeto para um repositório GitHub com a branch `main`.
2. Em **Settings → Pages**, escolha **GitHub Actions** como origem.
3. Execute o workflow **Publicar painel no GitHub Pages**, ou envie um novo commit para `main`.
4. O endereço publicado aparece na execução e em **Settings → Pages**.

Os arquivos do app usam caminhos relativos e funcionam no subdiretório de um site de projeto do GitHub Pages.

## Dados

`dist/data.json` contém as tags, quantidades e o mapeamento do G9SE. `dist/model.js` contém os componentes, bornes e conexões do desenho. `check.mjs` verifica as quantidades, os 14 bornes do G9SE, os jumpers e a independência das três linhas de saída.

As ligações foram transcritas das fotos e das confirmações do levantamento. T1 e a ponta solta de T2 permanecem sinalizados para confirmação. Nenhum estado de bobina ou contato é simulado.

Referência dos nomes e funções dos bornes: [catálogo oficial Omron G9SE](https://www.ia.omron.com/data_pdf/cat/g9se_j198-e1_4_7_csm1040781.pdf).
