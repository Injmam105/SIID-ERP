class AppConfig {
  // Configure this to your deployed Node.js + MySQL backend URL
  // Example for Android Emulator: http://10.0.2.2:3000/api
  // Example for Production Server: https://erp.sirahi.in/api
  static const String defaultApiBaseUrl = String.fromEnvironment(
    'SIID_API_URL',
    defaultValue: 'http://10.0.2.2:3000/api',
  );

  static const String companyName = 'Sirahi Infrastructure & Interior Design';
  static const String shortName = 'SIID ERP';
  static const String tagline = 'One Company. Multiple Projects. Complete Control.';
  static const String ownerName = 'MD Zawed Ansar';
  static const String ownerMobile = '9650598785';
  static const String officialEmail = 'sirahiinfrainteriordesign@gmail.com';
  static const String website = 'https://sirahi.in';
  static const String gstin = '07DCYPA1228R1ZZ';
  static const String developedBy = 'Injmam Ansari';
  static const String developerDesignation = 'IT Head of SIID';
  static const String itSupportNumber = '7503354996';

  static const List<String> commonConstructionBrands = [
    'UltraTech',
    'ACC',
    'Ambuja',
    'Tata Tiscon',
    'JSW Steel',
    'SAIL',
    'Asian Paints',
    'Berger Paints',
    'Nerolac',
    'Polycab',
    'Havells',
    'Finolex',
    'Anchor',
    'Legrand',
    'Kajaria',
    'Somany',
    'Johnson',
    'CenturyPly',
    'Greenply',
    'Jaquar',
    'Cera',
    'Hindware',
    'Supreme',
    'Astral',
    'Merino',
    'Greenlam',
    'Brand To Be Confirmed',
  ];
}
