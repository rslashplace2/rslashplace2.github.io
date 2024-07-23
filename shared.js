/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Contains shared resources across pages
const DEFAULT_SERVER = "wss://server.rplace.live:443"
const DEFAULT_BOARD = "https://raw.githubusercontent.com/rplacetk/canvas1/main/place"
const DEFAULT_AUTH = "https://server.rplace.live/auth"

const TRANSLATIONS = {
    en: {
        // Game
        connecting: "Connecting...",
        connectingFail: "Could not connect!",
        downloadingImage: "Downloading image...",
        placeTile: "Place a tile",
        donate: "Donate",
        myAccount: "My Account",
        chat: "Chat",
        liveChat: "Live Chat:",
        nicknameToContinue: "Enter a nickname to continue:",
        changeChannel: "Change channel:",
        captchaPrompt: "Solve this small captcha to help keep rplace.live fun for all...",
        webappInstall: "Install rplace.live web app",
        connectionProblems: "Connection problems?",
        tryClickingHere: "try clicking here",
        pleaseBeRespectful: "Please be respectful and try not to spam!",
        enterNickname: "Enter nickname...",
        enterMessage: "Enter message...",
        signInInstead: "Sign in instead",
        createNewAccount: "Create a new account",
        mention: "Mention",
        replyTo: "Reply to",
        report: "Report",
        block: "Block",
        unblock: "Unblock",
        changeMyName: "Change my name",
        putOnCanvas: "🫧 Put on canvas",
        sendInLiveChat: "📨 Send in live chat",
        overlayMenu: "Overlay menu",
        modalAboutContent: "There is an empty canvas.<br><br>You may place a tile upon it, but you must wait to place another.<br><br>Individually you can create something.<br><br>Together you can create something more.",
        overlayMenuDesciption: "Visualise your build with a template image!",
        messageCouldntBeLoaded: "Message could not be loaded",
        placedBy: "Placed by:",
        lockMessage: "This canvas is locked... You can't place pixels here anymore",
        adHidden: "Ad hidden for 14 days!",
        specialEventTitle: "Special event - 2023-2024 full canvas timelapse released!",
        copiedToClipboard: "Copied to clipboard!",

        // Posts
        rplaceLivePosts: "rplace.live posts",
        searchKeyword: "Search keyword",
        createPost: "Create post",
        communityPosts: "Community posts",
        sortBy: "Sort by:",
        hideSensitive: "Hide sensitive:",
        date: "Date",
        upvotes: "Upvotes",
    },
    fa: {
        connecting: "در حال وصل شدن",
        connectingFail: "متصل نشد",
        downloadingImage: "در حال بارگزاری عکس ها",
        placeTile: "نقاشی کردن",
        donate: "حمایت",
        myAccount: "حساب کاربری من",
        chat: "چت",
        liveChat: "چت زنده",
        nicknameToContinue: "لطفا نام خود را برای چت کردن وارد کنید",
        changeChannel: "تغییر کانال:",
        captchaPrompt: "لطفا روی دکمه حاوی ایموجی که در زیر می بینید کلیک کنید",
        webappInstall: "برنامه وب rplace.live را نصب کنید",
        connectionProblems: "مشکلات اتصال؟",
        tryClickingHere: "برای حل اینجا کلیک کنید",
        pleaseBeRespectful: "لطفا محترمانه رفتار کنید و سعی کنید اسپم نکنید!",
        enterNickname: "نام مستعار را وارد کنید...",
        enterMessage: "پیام را وارد کنید..."
    },
    tr: {
        connecting: "Bağlanıyor...",
        connectingFail: "Bağlanamadı!",
        downloadingImage: "Resim indiriliyor...",
        placeTile: "Bir piksel yerleştir",
        donate: "Bağış yap",
        myAccount: "Hesabım",
        chat: "Sohbet",
        // liveChat: "Canlı sohbet:", // TOO LONG
        nicknameToContinue: "Devam etmek için bir takma ad girin:",
        changeChannel: "Kanalı değiştir:",
        captchaPrompt: "Lütfen aşağıda gördüğünüz emojiyi içeren butona tıklayın",
        webappInstall: "rplace.live web uygulamasını kurun",
        connectionProblems: "Bağlantı problemleri?",
        tryClickingHere: "buraya tıklamayı dene",
        pleaseBeRespectful: "Lütfen saygılı olun ve spam yapmamaya çalışın!",
        enterNickname: "Takma ad girin...",
        enterMessage: "Mesaj girin...",
        signInInstead: "Oturum aç",
        createNewAccount: "Hesap oluştur",
        mention: "Etiketle",
        block: "Engellemek",
        changeMyName: "İsimi değiştir",
        putOnCanvas: "🫧 Haritanın üstüne yaz",
        sendInLiveChat: "📨 Sohbete yaz",
        overlayMenu: "Bindirme menüsü",
        modalAboutContent: "Boş bir tuval var.<br><br>Üzerine renkli bir piksel koyabilirsiniz ama yenisini yerleştirmek için beklemeniz gerekir.<br><br>Tek başınıza bir şeyler yapabilirsiniz.<br><br>Topluluk ile daha fazlasını yapabilirsiniz.",
        overlayMenuDesciption: "Haritanın üzerine bir fotoğraf koyun ve onu çizin!",
        specialEventTitle: "Özel etkinlik - 2023-2024 tam tuval timelapse yayınlandı!"
    },
    ro: {
        connecting: "Se conectează...",
        connectingFail: "Nu s-a putut conecta!",
        downloadingImage: "Se descarcă imaginea...",
        placeTile: "Pune un pixel",
        donate: "Donează",
        myAccount: "Contul meu",
        chat: "Conversații",
        //liveChat: "Conversații în direct:", // TOO LONG
        nicknameToContinue: "Introdu un nume pentru a continua:",
        changeChannel: "Schimbați canalul:",
        captchaPrompt: "Dați clic pe butonul care conține emoji-ul pe care îl vedeți mai jos",
        webappInstall: "Instalați aplicația web rplace.live",
        connectionProblems: "Probleme de conectare?",
        tryClickingHere: "incearca sa dai click aici",
        pleaseBeRespectful: "Vă rugăm să fiți respectuos și să nu trimiteți spam!",
        enterNickname: "Introduceți porecla...",
        enterMessage: "Introdu mesajul..."
    },
    el: {
        connecting: "Συνδετικός...",
        connectingFail: "Δεν μπορούσε να συνδεθεί!",
        downloadingImage: "Λήψη εικόνας...",
        placeTile: "τοποθετώ ένα πίξελ",
        donate: "δανεισω",
        myAccount: "Ο λογαριασμός μου",
        chat: "συζήτηση",
        //liveChat: "ζωντανή συζήτηση",  // TOO LONG
        nicknameToContinue: "Εισαγάγετε ένα ψευδώνυμο για να συνεχίσετε:",
        changeChannel: "Αλλαγή καναλιού:",
        captchaPrompt: "Κάντε κλικ στο κουμπί που περιέχει το emoji που βλέπετε παρακάτω",
        webappInstall: "Εγκαταστήστε την εφαρμογή web rplace.live",
        connectionProblems: "Προβλήματα σύνδεσης;",
        tryClickingHere: "δοκιμάστε να κάνετε κλικ εδώ",
        pleaseBeRespectful: "Παρακαλώ να είστε σεβαστές!",
        enterNickname: "Εισαγάγετε ψευδώνυμο...",
        enterMessage: "Εισαγάγετε μήνυμα..."
    },
    es: {
        connecting: "Conectando...",
        connectingFail: "¡No podía conectar!",
        downloadingImage: "Descargando imagen...",
        placeTile: "Coloca un pixel",
        donate: "Donar",
        myAccount: "Mi cuenta",
        chat: "Chat",
        liveChat: "Chat:",  // en vivo
        nicknameToContinue: "Introduce un apodo para continuar:",
        changeChannel: "Cambia el canal:",
        captchaPrompt: "Haga clic en el botón que contiene el emoji que ve a continuación",
        webappInstall: "Instale la aplicación web rplace.live",
        connectionProblems: "¿Problemas de conexión?",
        tryClickingHere: "intente hacer clic aquí",
        pleaseBeRespectful: "Por favor se respetuoso!",
        enterNickname: "Introduce el apodo...",
        enterMessage: "Introduce el mensaje...",
        specialEventTitle: "Evento especial: ¡lanzamiento del timelapse completo del lienzo 2023-2024!"
    },
    fr: {
        connecting: "De liaison...",
        connectingFail: "Impossible de se connecter!",
        downloadingImage: "Télécharger l'image...",
        placeTile: "Place un pixel",
        donate: "Faire un don",
        myAccount: "Mon compte",
        chat: "Discuter",
        //liveChat: "Chat en direct:", // TOO LONG
        nicknameToContinue: "Entrez un surnom pour continuer :",
        changeChannel: "Changer de chaîne:",
        captchaPrompt: "Veuillez cliquer sur le bouton contenant l'emoji que vous voyez ci-dessous",
        webappInstall: "Installez l'application Web rplace.live",
        connectionProblems: "Problèmes de connexion?",
        tryClickingHere: "résoudre en cliquant ici",
        pleaseBeRespectful: "Soyez respectueux et essayez de ne pas spammer !",
        enterNickname: "Entrez le pseudo...",
        enterMessage: "Saisissez le message..."
    },
    ru: {
        connecting: "Подключение...",
        connectingFail: "Не могу подключиться!",
        downloadingImage: "Загрузка изображения...",
        placeTile: "Поместите пиксель",
        donate: "Пожертвовать",
        myAccount: "Мой счет",
        chat: "Чат",
        liveChat: "Живой чат:",
        nicknameToContinue: "Введите псевдоним:",
        changeChannel: "Изменить канал:",
        captchaPrompt: "Пожалуйста, решите эту небольшую капчу, чтобы сделать rplace.live приятным для всех...",
        webappInstall: "Установите веб-приложение rplace.live",
        connectionProblems: "Проблемы с подключением?",
        tryClickingHere: "попробуйте нажать здесь",
        pleaseBeRespectful: "Пожалуйста, будьте уважительны и старайтесь не спамить!",
        enterNickname: "Введите псевдоним...",
        enterMessage: "Введите сообщение...",
        signInInstead: "зарегистрироваться вместо этого",
        createNewAccount: "создайте новый аккаунт",
        mention: "упомянуть",
        replyto: "ответить",
        report: "пожаловаться",
        block: "заблокировать",
        unblock: "разблокировать",
        changeMyName: "изменить моё имя",
        //putOnCanvas: ,
        sendInLiveChat: "Incoming_envelope:отправить в живой чат",
        overlaymenu: "меню наложения",
        modelAboutContent: "есть пустое полотно.<br><br> Вы можете поставить пиксель на нём,но вы должны подождать чтобы поставить ещё.<br<br>Вы можете создать что-то.<br><br> Вместе вы можете создать много.",
        overlayMenuDescription: "визуализируйте вашу постройку с шаблоном вашего изображения!"
    },
    uk: {
        connecting: "підключення...",
        connectingFail: "Не вдалося підключитися!",
        downloadingImage: "Завантажую зображення",
        placeTile: "Покласти піксель",
        donate: "Пожертвувати",
        myAccount: "Мій обліковий запис",
        chat: "Чат",
        liveChat: "Живий чат",
        nicknameToContinue: "Введіть ім'я щоб продовжити",
        changeChannel: "Зменіть канал",
        captchaPrompt: "вирішіть цю мальнеку captcha щоб допомогти залишити rplace.live веселим для всіх",
        webappInstall: "скачайте rplace.live веб-программу",
        connectionProblems: "Проблеми с підключенням?",
        tryClickingHere: "спробуйте клацнути сюди",
        pleaseBeRespectful: "будь ласка будьте поважними і не спамьте!",
        enterNickname: "Введіть ім'я...",
        enterMessage: "Введіть повідомлення",
        signInInstead: "Увійти замість цього",
        createNewAccount: "Створіть новий аккаунт",
        mention: "згадати",
        replyto: "Відповісти на",
        report: "Доповідь",
        block: "Заблокувати",
        unblock: "Разблокувати",
        changeMyName: "Змінити ім'я",
        putOnCanvas: "🫧поставити на полотно",
        sendInLiveChat: "📨відправьте в живий чат",
        overlaymenu: "Меню накладки",
        modelAboutContent: "Є пусте полотно.<br><br>Ви можете поставити піксель на ньому,<br><br>але вам треба почекати перед тим як поставити іще один.<br><br>Індиаідуально ви можете створити багато чого.",
        overlayMenuDescription: "Візуалізуйте вашу творчість с шаблоном зображення!"
    },
    de: {
        connecting: "Zugreifen...",
        connectingFail: "Konnte keine Verbindung herstellen!",
        downloadingImage: "Bild wird heruntergeladen...",
        placeTile: "Platziere ein Pixel",
        donate: "Spenden",
        myAccount: "Mein Konto",
        chat: "Chat",
        liveChat: "Live-Chat:",
        nicknameToContinue: "Geben Sie einen Spitznamen ein, um fortzufahren:",
        changeChannel: "Kanal wechseln:",
        captchaPrompt: "Bitte lösen Sie dieses kleine Captcha, damit rplace.live allen Spaß macht...",
        webappInstall: "Installieren Sie die Web-App rplace.live",
        connectionProblems: "Verbindungsprobleme?",
        tryClickingHere: "klicken Sie hier, um zu lösen",
        pleaseBeRespectful: "Bitte seien Sie respektvoll, nicht zu spammen!",
        enterNickname: "Spitznamen eingeben...",
        enterMessage: "Nachricht eingeben..."
    },
    hi: {
        connecting: "कनेक्टिंग ...",
        connectingFail: "कनेक्ट नहीं हो सका!",
        downloadingImage: "इमेज डाउनलोड हो रही है...",
        placeTile: "एक टाइल रखें",
        donate: "दान करें",
        myAccount: "मेरा खाता",
        chat: "चैट",
        liveChat: "लाइव चैट:",
        nicknameToContinue: "जारी रखने के लिए एक उपनाम दर्ज करें:",
        changeChannel: "चैनल बदलें:",
        captchaPrompt: "rplace.live को सभी के लिए मज़ेदार बनाए रखने में मदद के लिए कृपया इस छोटे कैप्चा को हल करें...",
        webappInstall: "rplace.live वेब ऐप इंस्टॉल करें",
        connectionProblems: "कनेक्शन समस्याएं?",
        tryClickingHere: "यहाँ क्लिक करने का प्रयास करें",
        pleaseBeRespectful: "कृपया सम्मान करें और स्पैम न करने का प्रयास करें!",
        enterNickname: "उपनाम दर्ज करें ...",
        enterMessage: "संदेश दर्ज करें ..."
    },
    ar: {
        connecting: "جار الاتصال...",
        connectingFail: "لقد فشل الاتصال!",
        downloadingImage: "جار تحميل الصورة...",
        placeTile: "ضع بلاطة",
        donate: "تبرع",
        myAccount: "حسابي",
        chat: "الدردشة",
        liveChat: "الدردشة المباشرة:",
        nicknameToContinue: "اكتب اسم مستعار للمواصلة:",
        changeChannel: "تغيير القناة:",
        captchaPrompt: "رجاءا قم بحل هذا اللغز...",
        webappInstall: "تحميل الموقع كتطبيق",
        connectionProblems: "مشاكل في الاتصال?",
        tryClickingHere: "جرب ان تضغط هنا",
        pleaseBeRespectful: "رجاءا كن محترما ولا تزعج الاخرين!",
        enterNickname: "اكتب اسم مستعار...",
        enterMessage: "اكتب الرسالة...",
        signInInstead: "قم بتسجيل الدخول من هنا بدلا من ذلك",
        createNewAccount: "انشئ حساب جديد",
        mention: "ذِكر",
        replyTo: "الرد على",
        report: "ابلاغ",
        block: "حظر",
        unblock: "ازالة الحظر",
        changeMyName: "غير اسمي",
        putOnCanvas: "🫧 ضع على اللوحه",
        sendInLiveChat: "📨 ارسل في الدردشة المباشرة",
        overlayMenu: "قائمة الصوره",
        modalAboutContent: "هنالك لوح فاضي.<br><br>تستطيع اضافة بلاطه, ولكن يجب عليك الانتظار لإضافة اخرى<br><br>لوحدك, تستطيع انشاء شيء.<br><br>مع الاخرين, تستطيع انشاء الكثير.",
        overlayMenuDesciption: "تصور بناءك بصورة نموذج!",
        messageCouldntBeLoaded: "لا يمكن تحميل الرسالة"
    },
    jp: {
        connecting: "接続中...",
        connectingFail: "接続できませんでした!",
        downloadingImage: "画像をダウンロードしています...",
        placeTile: "タイルを配置する",
        donate: "寄付する",
        myAccount: "マイアカウント",
        chat: "チャット",
        liveChat: "ライブチャット:",
        nicknameToContinue: "続行するにはニックネームを入力してください:",
        changeChannel: "チャンネルを変更:",
        captchaPrompt: "rplace.live をすべての人が楽しめるように、この小さなキャプチャを解決してください...",
        webappInstall: "rplace.live Web アプリをインストール",
        connectionProblems: "接続の問題?",
        tryClickingHere: "ここをクリックしてみてください",
        pleaseBeRespectful: "敬意を払い、スパム行為をしないようにしてください!",
        enterNickname: "ニックネームを入力してください...",
        enterMessage: "メッセージを入力してください..."
    }
}

const lang = navigator.language.split("-")[0]

//Thanks to (Discord) @carkan988"<%#1409, @anonimbiri#4089 for providing turkish translations, and @sorenaxmee#4191 and @rplacetk telegram contributors for persian translations, a big thanks (ig) to Cyart#9657 for romanian, greek and spanish translations, thanks to embed#2752 for french translation.
function translate(key) {
    if (TRANSLATIONS[lang] != null)
        return TRANSLATIONS[lang][key] || TRANSLATIONS["en"][key]
    else
        return TRANSLATIONS["en"][key] || key
}

function translateAll() {
	document.querySelectorAll("[translate]").forEach((element) => {
		const key = element.getAttribute("translate")
		if (TRANSLATIONS[lang] == null) return
		if (element.nodeName === "INPUT" || element.nodeName === "TEXTAREA") {
			if (element.getAttribute("type") == "text")
				element.placeholder = TRANSLATIONS[lang][key] || element.placeholder
			else
				element.value = TRANSLATIONS[lang][key] || element.value
		}
		else
			element.innerHTML = TRANSLATIONS[lang][key] || element.innerHTML
	})
}

class PublicPromise {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve
            this.reject = reject
        })
    }
}

function sanitise(txt) {
    return txt.replaceAll(/&/g,"&amp;").replaceAll(/</g,"&lt;").replaceAll(/"/g,"&quot;")
}

function markdownParse(text) {
    text = text.replace(/^(#{3}\s)(.*)/gm, (match, p1, p2) => {
        return `<h3 style="display:inline;">${p2}</h3>`
    })
    text = text.replace(/^(#{2}\s)(.*)/gm, (match, p1, p2) => {
        return `<h2 style="display:inline;">${p2}</h2>`
    })
    text = text.replace(/^(#{1}\s)(.*)/gm, (match, p1, p2) => {
        return `<h1 style="display:inline;">${p2}</h1>`
    })
    function matchBold(match) {
        return `<b>${match.slice(2, -2)}</b>`
    }
    text = text.replace(/\*\*([^*]+)\*\*/g, matchBold)
    text = text.replace(/\_\_([^*]+)\_\_/g, matchBold)
    function matchItalic(match) {
        return `<i>${match.slice(1, -1)}</i>`
    }
    text = text.replace(/\*([^*]+)\*/g, matchItalic)
    text = text.replace(/\_(.*)\_/g, matchItalic)

    text = text.replace(/\|\|([^*]+)\|\|/g, (match) => {
        return `<r-spoiler hidden="true">${match.slice(2, -2)}</r-spoiler>`
    })
    return text
}
