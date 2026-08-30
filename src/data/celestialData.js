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
    modelPath: "/public/models/solar_system/earth.glb",
    displaySize: 0.90, // Ukuran tampil di AR (unit relatif terhadap lebar marker)
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
    modelPath: "/public/models/solar_system/mars.glb",
    displaySize: 0.80, // Mars dibuat sedikit lebih kecil dari Bumi sesuai proporsi visual
    description: "Planet keempat dari Matahari dengan permukaan gurun berbatu yang kaya akan besi(III) oksida, memberikannya warna kemerahan yang khas.",
    doi: "10.1126/science.1246417"
  }
};
