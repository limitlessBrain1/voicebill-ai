// Centralized translation dictionary for VoiceBill.AI supporting English (en) and Marathi (mr)

export type Language = 'en' | 'mr';

export interface Translations {
  // Navigation & Shell
  navOverview: string;
  navBilling: string;
  navSales: string;
  navInventory: string;
  navVoiceProducts: string;
  logout: string;
  systemConnected: string;
  receiptFormat: string;
  newBill: string;
  loadingApp: string;

  // Common Actions
  add: string;
  save: string;
  saveAll: string;
  saving: string;
  cancel: string;
  delete: string;
  deleting: string;
  edit: string;
  close: string;
  clear: string;
  clearForm: string;
  refresh: string;
  search: string;
  filter: string;
  reset: string;
  actions: string;
  status: string;
  confirm: string;
  back: string;

  // Language Selector
  language: string;
  langEnglish: string;
  langMarathi: string;

  // Voice & Manual Product Entry Page
  productEntryTitle: string;
  productEntrySubtitle: string;
  tabVoiceEntry: string;
  tabManualEntry: string;
  voiceInputDesc: string;
  voicePlaceholder: string;
  parseTranscript: string;
  parsing: string;
  exampleCommands: string;
  
  // Manual Entry Form
  manualFormTitle: string;
  manualFormSubtitle: string;
  productName: string;
  productNamePlaceholder: string;
  productNameReq: string;
  category: string;
  selectCategory: string;
  noCategory: string;
  addNewCategory: string;
  newCategoryPrompt: string;
  purchasePrice: string;
  sellingPrice: string;
  stockQuantity: string;
  packSize: string;
  unit: string;
  selectUnit: string;
  lowStockThreshold: string;
  barcode: string;
  barcodePlaceholder: string;
  addToStaging: string;
  saveDirectly: string;
  stagedProductsTitle: string;
  stagedProductsCount: string;
  noStagedProducts: string;
  productAddedSuccess: string;
  productSavedSuccess: string;
  batchSaveSuccess: string;
  validationError: string;
  nameRequired: string;
  priceInvalid: string;
  stockInvalid: string;

  // Inventory Page
  inventoryTitle: string;
  inventorySubtitle: string;
  totalProducts: string;
  inStock: string;
  lowStock: string;
  outOfStock: string;
  inactive: string;
  allCategories: string;
  allStockStatuses: string;
  searchProductsPlaceholder: string;
  showingProducts: string;
  ofProducts: string;
  noProductsFound: string;
  noProductsDesc: string;
  addFirstProduct: string;
  colName: string;
  colCategory: string;
  colPurchasePrice: string;
  colSellingPrice: string;
  colAvailableStock: string;
  colUnit: string;
  colStatus: string;
  colActions: string;
  updateStock: string;
  quickStockTitle: string;
  editProductTitle: string;
  deleteConfirmTitle: string;
  deleteConfirmDesc: string;
  deleteSuccess: string;
  updateSuccess: string;
  stockUpdatedSuccess: string;
  rowsPerPage: string;
  page: string;
  of: string;
  prev: string;
  next: string;

  // Billing Counter
  billingTitle: string;
  billingSubtitle: string;
  scanOrSelect: string;
  cartEmpty: string;
  cartEmptySub: string;
  subtotal: string;
  discount: string;
  grandTotal: string;
  checkout: string;
  clearCart: string;
  qty: string;
  price: string;
  total: string;
  outOfStockAlert: string;
  completeSale: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // Navigation & Shell
    navOverview: 'Overview',
    navBilling: 'Billing Counter',
    navSales: 'Sales History',
    navInventory: 'Products & Inventory',
    navVoiceProducts: 'Product Entry',
    logout: 'Log Out',
    systemConnected: 'System Connected',
    receiptFormat: 'Receipt Format',
    newBill: 'New Bill',
    loadingApp: 'Loading VoiceBill.AI...',

    // Common Actions
    add: 'Add',
    save: 'Save',
    saveAll: 'Save All to Inventory',
    saving: 'Saving...',
    cancel: 'Cancel',
    delete: 'Delete',
    deleting: 'Deleting...',
    edit: 'Edit',
    close: 'Close',
    clear: 'Clear',
    clearForm: 'Clear Form',
    refresh: 'Refresh',
    search: 'Search',
    filter: 'Filter',
    reset: 'Reset',
    actions: 'Actions',
    status: 'Status',
    confirm: 'Confirm',
    back: 'Back',

    // Language Selector
    language: 'Language',
    langEnglish: 'English',
    langMarathi: 'मराठी (Marathi)',

    // Voice & Manual Product Entry Page
    productEntryTitle: 'Add Products to Inventory',
    productEntrySubtitle: 'Add store catalog items via Voice speech commands or Manual entry',
    tabVoiceEntry: 'Voice / Speech Input',
    tabManualEntry: 'Manual Product Entry',
    voiceInputDesc: 'Speak or paste grocery item details. VoiceBill.AI automatically extracts price, pack size, unit, and stock quantity.',
    voicePlaceholder: 'e.g. Add sugar 1 kg, purchase price 40, selling price 45, stock 20 kg.',
    parseTranscript: 'Parse Voice Command',
    parsing: 'Parsing Speech...',
    exampleCommands: 'Example Voice Prompts',

    // Manual Entry Form
    manualFormTitle: 'Manual Item Creation',
    manualFormSubtitle: 'Enter product specifications directly using English or Marathi Unicode text',
    productName: 'Product Name',
    productNamePlaceholder: 'e.g. साखर (Sugar), Fortune Oil, Tata Salt',
    productNameReq: 'Product name is required (English or Marathi)',
    category: 'Category',
    selectCategory: 'Select Category',
    noCategory: 'No Category (General)',
    addNewCategory: '+ Add New Category',
    newCategoryPrompt: 'Enter new category name:',
    purchasePrice: 'Purchase Price (₹)',
    sellingPrice: 'Selling Price (₹)',
    stockQuantity: 'Available Stock',
    packSize: 'Pack Size',
    unit: 'Unit of Measure',
    selectUnit: 'Select Unit',
    lowStockThreshold: 'Low Stock Alert Threshold',
    barcode: 'Barcode / SKU (Optional)',
    barcodePlaceholder: 'Scan or type barcode',
    addToStaging: '+ Add to Review List',
    saveDirectly: 'Save Directly to Inventory',
    stagedProductsTitle: 'Review Products Before Saving',
    stagedProductsCount: 'Staged Items',
    noStagedProducts: 'No products staged yet. Fill the form above and click "Add to Review List".',
    productAddedSuccess: 'Product added to review list successfully.',
    productSavedSuccess: 'Product saved directly to inventory database.',
    batchSaveSuccess: 'All staged products successfully saved to database.',
    validationError: 'Please correct the highlighted fields before proceeding.',
    nameRequired: 'Product name cannot be empty.',
    priceInvalid: 'Prices must be non-negative numeric values.',
    stockInvalid: 'Stock quantity and pack size must be valid numbers.',

    // Inventory Page
    inventoryTitle: 'Products & Store Inventory',
    inventorySubtitle: 'Live stock quantities, pricing margins, category filters and catalog management',
    totalProducts: 'Total Products',
    inStock: 'In Stock',
    lowStock: 'Low Stock',
    outOfStock: 'Out of Stock',
    inactive: 'Inactive',
    allCategories: 'All Categories',
    allStockStatuses: 'All Stock Statuses',
    searchProductsPlaceholder: 'Search by product name (English or मराठी), barcode, or category...',
    showingProducts: 'Showing',
    ofProducts: 'of',
    noProductsFound: 'No Products Found',
    noProductsDesc: 'No items match your active search or filter criteria. Try clearing search or add new products.',
    addFirstProduct: 'Add Your First Product',
    colName: 'Product Name',
    colCategory: 'Category',
    colPurchasePrice: 'Purchase Price',
    colSellingPrice: 'Selling Price',
    colAvailableStock: 'Available Stock',
    colUnit: 'Unit',
    colStatus: 'Stock Status',
    colActions: 'Actions',
    updateStock: 'Update Stock',
    quickStockTitle: 'Quick Stock Adjustment',
    editProductTitle: 'Edit Product Details',
    deleteConfirmTitle: 'Delete Product',
    deleteConfirmDesc: 'Are you sure you want to deactivate and remove this product from active inventory?',
    deleteSuccess: 'Product deactivated and removed from active catalog.',
    updateSuccess: 'Product details updated successfully.',
    stockUpdatedSuccess: 'Stock quantity updated successfully.',
    rowsPerPage: 'Rows per page:',
    page: 'Page',
    of: 'of',
    prev: 'Previous',
    next: 'Next',

    // Billing Counter
    billingTitle: 'Billing Counter',
    billingSubtitle: 'Fast retail point-of-sale & checkout',
    scanOrSelect: 'Scan barcode or select products to add to current bill',
    cartEmpty: 'Billing Cart is Empty',
    cartEmptySub: 'Select items from catalog or speak into the voice bar to ring up products.',
    subtotal: 'Subtotal',
    discount: 'Discount',
    grandTotal: 'Grand Total',
    checkout: 'Checkout & Print Receipt',
    clearCart: 'Clear Cart',
    qty: 'Qty',
    price: 'Price',
    total: 'Total',
    outOfStockAlert: 'Product is currently out of stock.',
    completeSale: 'Complete Sale',
  },

  mr: {
    // Navigation & Shell
    navOverview: 'डॅशबोर्ड',
    navBilling: 'बिलिंग काउंटर',
    navSales: 'विक्री इतिहास',
    navInventory: 'उत्पादने आणि इन्व्हेंटरी',
    navVoiceProducts: 'उत्पादन नोंदणी',
    logout: 'लॉग आउट',
    systemConnected: 'सिस्टम कनेक्टेड',
    receiptFormat: 'पावती स्वरूप',
    newBill: 'नवीन बिल',
    loadingApp: 'VoiceBill.AI लोड होत आहे...',

    // Common Actions
    add: 'जोडा',
    save: 'जतन करा',
    saveAll: 'सर्व उत्पादने जतन करा',
    saving: 'जतन करत आहे...',
    cancel: 'रद्द करा',
    delete: 'हटवा',
    deleting: 'हटवत आहे...',
    edit: 'संपादित करा',
    close: 'बंद करा',
    clear: 'साफ करा',
    clearForm: 'फॉर्म साफ करा',
    refresh: 'रिफ्रेश',
    search: 'शोधा',
    filter: 'फिल्टर',
    reset: 'रीसेट',
    actions: 'क्रिया',
    status: 'स्थिती',
    confirm: 'पुष्टी करा',
    back: 'मागे',

    // Language Selector
    language: 'भाषा',
    langEnglish: 'English',
    langMarathi: 'मराठी (Marathi)',

    // Voice & Manual Product Entry Page
    productEntryTitle: 'इन्व्हेंटरीमध्ये उत्पादने जोडा',
    productEntrySubtitle: 'व्हॉइस कमांड किंवा मॅन्युअल नोंदीद्वारे दुकानातील मालाची नोंद करा',
    tabVoiceEntry: 'व्हॉइस / आवाज इनपुट',
    tabManualEntry: 'मॅन्युअल उत्पादन नोंद',
    voiceInputDesc: 'किराणा मालाचे तपशील बोला किंवा टाईप करा. VoiceBill.AI आपोआप किंमत, पॅक आकार, एकक आणि साठा शोधून काढते.',
    voicePlaceholder: 'उदा. साखर १ किलो खरेदी दर ४० विक्री दर ४५ साठा २० किलो जोडा.',
    parseTranscript: 'व्हॉइस कमांड तपासा',
    parsing: 'आवाज तपासत आहे...',
    exampleCommands: 'नमुना व्हॉइस आज्ञा',

    // Manual Entry Form
    manualFormTitle: 'मॅन्युअल उत्पादन नोंदणी',
    manualFormSubtitle: 'मराठी किंवा इंग्रजीमध्ये थेट उत्पादनाची माहिती प्रविष्ट करा',
    productName: 'उत्पादनाचे नाव',
    productNamePlaceholder: 'उदा. साखर, तांदूळ, गहू, खाद्यतेल, मीठ',
    productNameReq: 'उत्पादनाचे नाव आवश्यक आहे (मराठी किंवा इंग्रजी)',
    category: 'श्रेणी (कॅटेगरी)',
    selectCategory: 'श्रेणी निवडा',
    noCategory: 'कोणतीही श्रेणी नाही (सामान्य)',
    addNewCategory: '+ नवीन श्रेणी जोडा',
    newCategoryPrompt: 'नवीन श्रेणीचे नाव टाका:',
    purchasePrice: 'खरेदी किंमत (₹)',
    sellingPrice: 'विक्री किंमत (₹)',
    stockQuantity: 'उपलब्ध साठा (स्टॉक)',
    packSize: 'पॅक साईझ',
    unit: 'एकक (युनिट)',
    selectUnit: 'एकक निवडा',
    lowStockThreshold: 'कमी साठा सूचना मर्यादा',
    barcode: 'बारकोड / SKU (पर्यायी)',
    barcodePlaceholder: 'बारकोड स्कॅन किंवा टाईप करा',
    addToStaging: '+ पुनरावलोकन यादीत जोडा',
    saveDirectly: 'थेट इन्व्हेंटरीमध्ये जतन करा',
    stagedProductsTitle: 'जतन करण्यापूर्वी उत्पादनांचे पुनरावलोकन',
    stagedProductsCount: 'यादीतील वस्तू',
    noStagedProducts: 'अद्याप कोणतीही उत्पादने जोडलेली नाहीत. वरील फॉर्म भरा आणि "+ पुनरावलोकन यादीत जोडा" वर क्लिक करा.',
    productAddedSuccess: 'उत्पादन पुनरावलोकन यादीत यशस्वीरीत्या जोडले गेले.',
    productSavedSuccess: 'उत्पादन थेट इन्व्हेंटरीमध्ये जतन केले गेले.',
    batchSaveSuccess: 'सर्व उत्पादने यशस्वीरीत्या डेटाबेसमध्ये जतन केली गेली.',
    validationError: 'कृपया पुढे जाण्यापूर्वी आवश्यक माहिती योग्य प्रकारे भरा.',
    nameRequired: 'उत्पादनाचे नाव रिकामे असू शकत नाही.',
    priceInvalid: 'किंमत योग्य संख्या असणे आवश्यक आहे (शून्यापेक्षा कमी नको).',
    stockInvalid: 'साठा आणि पॅक साईझ योग्य संख्या असणे आवश्यक आहे.',

    // Inventory Page
    inventoryTitle: 'उत्पादने आणि दुकान इन्व्हेंटरी',
    inventorySubtitle: 'थेट साठा, नफा मार्जिन, श्रेणी फिल्टर्स आणि कॅटलॉग व्यवस्थापन',
    totalProducts: 'एकूण उत्पादने',
    inStock: 'साठ्यात उपलब्ध',
    lowStock: 'कमी साठा (Low Stock)',
    outOfStock: 'साठा संपला (Out of Stock)',
    inactive: 'निष्क्रिय',
    allCategories: 'सर्व श्रेणी',
    allStockStatuses: 'सर्व साठा स्थिती',
    searchProductsPlaceholder: 'उत्पादनाचे नाव (मराठी किंवा English), बारकोड किंवा श्रेणीनुसार शोधा...',
    showingProducts: 'दाखवत आहे',
    ofProducts: 'पैकी',
    noProductsFound: 'कोणतीही उत्पादने आढळली नाहीत',
    noProductsDesc: 'तुमच्या शोध निकषांनुसार कोणतेही उत्पादन सापडले नाही. शोध साफ करा किंवा नवीन उत्पादन जोडा.',
    addFirstProduct: 'पहिले उत्पादन जोडा',
    colName: 'उत्पादनाचे नाव',
    colCategory: 'श्रेणी',
    colPurchasePrice: 'खरेदी किंमत',
    colSellingPrice: 'विक्री किंमत',
    colAvailableStock: 'उपलब्ध साठा',
    colUnit: 'एकक',
    colStatus: 'साठा स्थिती',
    colActions: 'क्रिया',
    updateStock: 'साठा बदला',
    quickStockTitle: 'साठा त्वरित बदल',
    editProductTitle: 'उत्पादन तपशील संपादित करा',
    deleteConfirmTitle: 'उत्पादन हटवा',
    deleteConfirmDesc: 'तुम्हाला खात्री आहे का की तुम्ही हे उत्पादन सक्रिय इन्व्हेंटरीमधून हटवू इच्छिता?',
    deleteSuccess: 'उत्पादन यशस्वीरीत्या निष्क्रीय करण्यात आले.',
    updateSuccess: 'उत्पादनाची माहिती यशस्वीरीत्या अद्यतनित केली.',
    stockUpdatedSuccess: 'साठा यशस्वीरीत्या अद्यतनित केला गेला.',
    rowsPerPage: 'प्रति पृष्ठ पंक्ती:',
    page: 'पृष्ठ',
    of: 'पैकी',
    prev: 'मागील',
    next: 'पुढील',

    // Billing Counter
    billingTitle: 'बिलिंग काउंटर',
    billingSubtitle: 'जलद किरकोळ विक्री आणि चेकआउट',
    scanOrSelect: 'बिलामध्ये जोडण्यासाठी बारकोड स्कॅन करा किंवा उत्पादन निवडा',
    cartEmpty: 'बिलिंग कार्ट रिकामी आहे',
    cartEmptySub: 'कॅटलॉगमधून वस्तू निवडा किंवा व्हॉइस बारमध्ये बोलून उत्पादने जोडा.',
    subtotal: 'एकूण रक्कम',
    discount: 'सूट (Discount)',
    grandTotal: 'अंतिम एकूण रक्कम',
    checkout: 'चेकआउट आणि पावती छापा',
    clearCart: 'कार्ट रिकामी करा',
    qty: 'संख्या',
    price: 'दर',
    total: 'एकूण',
    outOfStockAlert: 'हे उत्पादन सध्या साठ्यात उपलब्ध नाही.',
    completeSale: 'विक्री पूर्ण करा',
  },
};
