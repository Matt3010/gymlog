package work.scanferlamatteo.gymlog;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * gymlog come app: una WebView sola, a tutto schermo, sull'indirizzo dell'app.
 * Quello che sta su gymlog si apre qui; un collegamento ad altri siti si apre
 * nel browser. Il tasto indietro torna indietro nell'app prima di chiuderla.
 */
public class MainActivity extends Activity {

    private static final String HOME = "https://gymlog.scanferlamatteo.work/";
    private static final String HOST = Uri.parse(HOME).getHost();

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        // la scheda scelta, il recupero in corso: l'app li tiene nel localStorage
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        // l'app sta tutta sul server: niente file né contenuti del telefono dentro la pagina
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setUserAgentString(settings.getUserAgentString() + " gymlog-android");

        // i cookie della sessione restano anche chiudendo l'app: si resta dentro
        CookieManager.getInstance().setAcceptCookie(true);

        web.setBackgroundColor(0xFF0E1116);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme();
                // gymlog, solo in https, resta qui
                if ("https".equals(scheme) && HOST.equals(url.getHost())) return false;
                // un sito qualsiasi va nel browser; un altro schema (intent:, market:…) non apre niente
                if (!"https".equals(scheme) && !"http".equals(scheme)) return true;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (ActivityNotFoundException ignored) {
                    // nessuna app sa aprirlo: non si va da nessuna parte
                }
                return true;
            }
        });

        if (state == null || web.restoreState(state) == null) web.loadUrl(HOME);
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        web.saveState(state);
    }

    @Override
    protected void onPause() {
        super.onPause();
        // scritti su disco subito: se Android chiude l'app in sottofondo, la sessione c'e' ancora
        CookieManager.getInstance().flush();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
