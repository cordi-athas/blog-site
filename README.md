# İzin Takvimi

Türkiye resmi tatillerini yıllık takvimde gösteren ve **en az izinle en uzun tatili** planlamana yardım eden statik web uygulaması.

## Özellikler

- **Yıllık takvim** (2025–2028): resmi tatiller, arife (yarım gün) ve hafta sonları renkli.
- **Köprü fırsatları:** Her tatil için "X gün izin → Y gün kesintisiz tatil" seçenekleri; en verimli seçenek işaretli. Üzerine gelince takvimde önizlenir, tıklayınca planına eklenir.
- **Akıllı plan:** Yıllık izin hakkını girersin; algoritma resmi tatilleri birleştirerek toplam kesintisiz tatili en çoklayan planı bulur (bütçeli ağırlıklı aralık seçimi, dinamik programlama).
- **Kendi planın:** Takvimdeki iş günlerine tıklayarak izin ekle/çıkar; kullanılan/kalan izin ve oluşan tatil blokları anlık hesaplanır.
- **Cumartesi çalışanlar** için ayar.
- Arife günleri yarım gün izin sayılır.
- Yıl geçişleri (ör. Aralık sonu + Yılbaşı) hesaba katılır.
- Planı **.ics** olarak Google/Apple/Outlook takvimine aktarma.
- Seçimler tarayıcıda (localStorage) saklanır; sunucu yok.

## Geliştirme

```bash
npm install
npm run dev      # geliştirme sunucusu
npm test         # algoritma testleri (vitest)
npm run build    # dist/ klasörüne statik çıktı
```

`dist/` klasörü herhangi bir statik barındırmaya (GitHub Pages, Netlify, Vercel, Cloudflare Pages) doğrudan yüklenebilir.

## Veri

Tatil verileri `src/data/holidays.ts` içindedir. Dini bayramlar Diyanet İşleri Başkanlığı takvimine göredir; 2028 tarihleri **tahminidir** ve sitede bu şekilde işaretlenir. Yeni yıl eklemek için `RELIGIOUS` tablosuna bayramların ilk günlerini girmen yeterli.

## Yapı

```
src/
  data/holidays.ts      resmi tatil verisi
  lib/planner.ts        gün modeli, fırsat bulma, gruplama, plan optimizasyonu
  lib/planner.test.ts   testler
  lib/dates.ts          tarih yardımcıları (TR)
  lib/ics.ts            .ics dışa aktarma
  components/Calendar.tsx
  App.tsx, styles.css
```
