# Uneix PDF

Aplicació web per ajuntar diversos fitxers PDF i descarregar-ne un de sol. Tot el processament
es fa al navegador: **cap fitxer s'envia a cap servidor**.

## Funcions

- Arrossega i deix anar (o selecciona) diversos PDF alhora.
- Reordena els fitxers arrossegant les targetes o amb els botons amunt/avall.
- Tria quines pàgines s'inclouen de cada PDF amb rangs com `1-3, 5, 8-` (deixant el camp buit
  s'hi inclouen totes).
- Elimina fitxers individuals o buida la llista sencera.
- Defineix el nom del PDF de sortida i descarrega el resultat.
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

## Tecnologia

React + TypeScript + Vite, amb `pdf-lib` per a la manipulació dels PDF.
