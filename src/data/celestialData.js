/**
 * Dataset Astrofisika Objek Tata Surya
 * Menggunakan data ilmiah terverifikasi dan rujukan DOI resmi.
 */

export const celestialData = {
  earth: {
    id: "earth",
    name: "Bumi (Earth)",
    category: "Planet Terestrial",
    mass: "5.972 × 10²⁴ kg",
    radius: "6,371 km",
    semiMajorAxis: "1.000 AU (149.6 juta km)",
    surfaceTemp: "288 K (15 °C)",
    modelPath: "./models/solar_system/earth.glb",
    displaySize: 0.90, // Ukuran tampil di AR (unit relatif terhadap lebar marker)
    defaultRotation: [Math.PI / 2, 0, 0], // Fix orientasi: rotasi 90 derajat di sumbu X
    description: "Planet ketiga dari Matahari yang merupakan satu-satunya benda astronomi yang diketahui menampung kehidupan. Memiliki atmosfer kaya oksigen dan samudra air cair.",
    doi: "10.1038/s41586-020-2094-0"
  },
  mars: {
    id: "mars",
    name: "Mars",
    category: "Planet Terestrial",
    mass: "6.417 × 10²³ kg",
    radius: "3,389.5 km",
    semiMajorAxis: "1.524 AU (227.9 juta km)",
    surfaceTemp: "210 K (-63 °C)",
    modelPath: "./models/solar_system/mars.glb",
    displaySize: 0.90, // Mars dibuat sedikit lebih kecil dari Bumi sesuai proporsi visual
    defaultRotation: [Math.PI / 2, 0, 0],
    description: "Planet keempat dari Matahari dengan permukaan gurun berbatu yang kaya akan besi(III) oksida, memberikannya warna kemerahan yang khas.",
    doi: "10.1126/science.1246417"
  },
  moon: {
    id: "moon",
    name: "Bulan (Moon)",
    category: "Satelit Alami",
    mass: "7.342 × 10²² kg",
    radius: "1,737.4 km",
    semiMajorAxis: "0.00257 AU (384,400 km)",
    surfaceTemp: "120 K s.d. 390 K (-153 °C s.d. 117 °C)",
    modelPath: "./models/solar_system/moon.glb",
    displaySize: 0.90,
    defaultRotation: [Math.PI / 2, 0, 0],
    description: "Satelit alami satu-satunya Bumi dan satelit alami terbesar kelima di Tata Surya. Berperan penting dalam menstabilkan kemiringan sumbu Bumi dan menciptakan pasang surut laut.",
    doi: "10.1038/nature07842"
  },
  sun: {
    id: "sun",
    name: "Matahari (Sun)",
    category: "Bintang (Spektral G2V)",
    mass: "1.989 × 10³⁰ kg",
    radius: "696,340 km",
    semiMajorAxis: "Pusat Tata Surya (0 AU)",
    surfaceTemp: "5,778 K (5,505 °C)",
    modelPath: "./models/solar_system/sun.glb",
    displaySize: 0.95,
    defaultRotation: [Math.PI / 2, 0, 0],
    description: "Bintang deret utama di pusat Tata Surya yang menyumbang sekitar 99.86% dari massa total seluruh sistem. Menghasilkan energi radiasi raksasa melalui fusi hidrogen menjadi helium di intinya.",
    doi: "10.1038/s41586-020-03043-4"
  }
};
