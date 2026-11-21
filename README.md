# Uneix PDF

Aplicació web per **ajuntar diversos PDF en un de sol** i per **separar les pàgines en PDF
individuals**. Tot el processament es fa al navegador: **cap fitxer s'envia a cap servidor**.

## Funcions

- Dos modes: `Uneix en un PDF` i `Separa per pàgines`.
- Arrossega i deix anar (o selecciona) diversos PDF alhora.
- Reordena els fitxers arrossegant les targetes o amb els botons amunt/avall.
- Tria quines pàgines s'inclouen (mode uneix) o s'extreuen (mode separa) amb rangs com
  `1-3, 5, 8-` (deixant el camp buit s'hi inclouen totes).
- En separar, cada pàgina es genera com a PDF independent i es pot desar:
  - dins d'un **fitxer ZIP** (recomanat), o
  - com a **fitxers PDF separats** (el navegador pot demanar permís per a descàrregues múltiples).
- Elimina fitxers individuals o buida la llista sencera.
- Defineix el nom del PDF de sortida o el prefix dels fitxers generats.
- Avísos clars per a fitxers corruptes, xifrats o rangs incorrectes.
- Interfície en català, adaptable a mòbil i amb estil coherent amb la resta d'apps.

## Desenvolupament

```bash
npm install
npm run dev       # servidor de desenvolupament
npm run build     # comprova tipus i genera dist/
npm run preview   # previsualitza la versió compilada
npm test          # proves unitàries
```

## Desplegament

El projecte està publicat a **https://danicano77.github.io/uneix-pdf/**.

Cada push a `main` executa `.github/workflows/deploy.yml`, que compila l'app amb `npm ci &&
npm run build` i publica el contingut de `dist/` a GitHub Pages. Pages està configurat amb
`build_type: workflow`.

## Tecnologia

React + TypeScript + Vite, amb `pdf-lib` per a la manipulació dels PDF i `fflate` per generar
els ZIP. Ambdues llibreries es carreguen sota demanda per mantenir l'arrencada lleugera.
