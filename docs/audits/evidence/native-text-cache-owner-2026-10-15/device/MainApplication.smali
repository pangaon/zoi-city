.class public final Lcom/usgreekscan/zoi/MainApplication;
.super Landroid/app/Application;
.source "MainApplication.kt"

# interfaces
.implements Lcom/facebook/react/ReactApplication;


# annotations
.annotation runtime Lkotlin/Metadata;
    d1 = {
        "\u0000&\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0008\u0003\n\u0002\u0018\u0002\n\u0002\u0008\u0005\n\u0002\u0010\u0002\n\u0002\u0008\u0002\n\u0002\u0018\u0002\n\u0000\u0018\u00002\u00020\u00012\u00020\u0002B\u0007\u00a2\u0006\u0004\u0008\u0003\u0010\u0004J\u0008\u0010\u000b\u001a\u00020\u000cH\u0016J\u0010\u0010\r\u001a\u00020\u000c2\u0006\u0010\u000e\u001a\u00020\u000fH\u0016R\u001b\u0010\u0005\u001a\u00020\u00068VX\u0096\u0084\u0002\u00a2\u0006\u000c\n\u0004\u0008\t\u0010\n\u001a\u0004\u0008\u0007\u0010\u0008\u00a8\u0006\u0010"
    }
    d2 = {
        "Lcom/usgreekscan/zoi/MainApplication;",
        "Landroid/app/Application;",
        "Lcom/facebook/react/ReactApplication;",
        "<init>",
        "()V",
        "reactHost",
        "Lcom/facebook/react/ReactHost;",
        "getReactHost",
        "()Lcom/facebook/react/ReactHost;",
        "reactHost$delegate",
        "Lkotlin/Lazy;",
        "onCreate",
        "",
        "onConfigurationChanged",
        "newConfig",
        "Landroid/content/res/Configuration;",
        "app_release"
    }
    k = 0x1
    mv = {
        0x2,
        0x1,
        0x0
    }
    xi = 0x30
.end annotation


# instance fields
.field private final reactHost$delegate:Lkotlin/Lazy;


# direct methods
.method public static synthetic $r8$lambda$sMlchM4iVNzPol8WMiqS7_wxRxE(Lcom/usgreekscan/zoi/MainApplication;)Lcom/facebook/react/ReactHost;
    .registers 1

    invoke-static {p0}, Lcom/usgreekscan/zoi/MainApplication;->reactHost_delegate$lambda$1(Lcom/usgreekscan/zoi/MainApplication;)Lcom/facebook/react/ReactHost;

    move-result-object p0

    return-object p0
.end method

.method public constructor <init>()V
    .registers 2

    .line 17
    invoke-direct {p0}, Landroid/app/Application;-><init>()V

    .line 19
    new-instance v0, Lcom/usgreekscan/zoi/MainApplication$$ExternalSyntheticLambda0;

    invoke-direct {v0, p0}, Lcom/usgreekscan/zoi/MainApplication$$ExternalSyntheticLambda0;-><init>(Lcom/usgreekscan/zoi/MainApplication;)V

    invoke-static {v0}, Lkotlin/LazyKt;->lazy(Lkotlin/jvm/functions/Function0;)Lkotlin/Lazy;

    move-result-object v0

    iput-object v0, p0, Lcom/usgreekscan/zoi/MainApplication;->reactHost$delegate:Lkotlin/Lazy;

    return-void
.end method

.method private static final reactHost_delegate$lambda$1(Lcom/usgreekscan/zoi/MainApplication;)Lcom/facebook/react/ReactHost;
    .registers 11

    .line 21
    invoke-virtual {p0}, Lcom/usgreekscan/zoi/MainApplication;->getApplicationContext()Landroid/content/Context;

    move-result-object v0

    const-string v1, "getApplicationContext(...)"

    invoke-static {v0, v1}, Lkotlin/jvm/internal/Intrinsics;->checkNotNullExpressionValue(Ljava/lang/Object;Ljava/lang/String;)V

    .line 23
    new-instance v1, Lcom/facebook/react/PackageList;

    check-cast p0, Landroid/app/Application;

    invoke-direct {v1, p0}, Lcom/facebook/react/PackageList;-><init>(Landroid/app/Application;)V

    invoke-virtual {v1}, Lcom/facebook/react/PackageList;->getPackages()Ljava/util/ArrayList;

    move-result-object p0

    const-string v1, "apply(...)"

    invoke-static {p0, v1}, Lkotlin/jvm/internal/Intrinsics;->checkNotNullExpressionValue(Ljava/lang/Object;Ljava/lang/String;)V

    move-object v1, p0

    check-cast v1, Ljava/util/List;

    const/16 v8, 0xfc

    const/4 v9, 0x0

    const/4 v2, 0x0

    const/4 v3, 0x0

    const/4 v4, 0x0

    const/4 v5, 0x0

    const/4 v6, 0x0

    const/4 v7, 0x0

    .line 20
    invoke-static/range {v0 .. v9}, Lexpo/modules/ExpoReactHostFactory;->getDefaultReactHost$default(Landroid/content/Context;Ljava/util/List;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Lcom/facebook/react/runtime/JSRuntimeFactory;ZLcom/facebook/react/runtime/BindingsInstaller;ILjava/lang/Object;)Lcom/facebook/react/ReactHost;

    move-result-object p0

    return-object p0
.end method


# virtual methods
.method public getReactHost()Lcom/facebook/react/ReactHost;
    .registers 2

    .line 19
    iget-object v0, p0, Lcom/usgreekscan/zoi/MainApplication;->reactHost$delegate:Lkotlin/Lazy;

    invoke-interface {v0}, Lkotlin/Lazy;->getValue()Ljava/lang/Object;

    move-result-object v0

    check-cast v0, Lcom/facebook/react/ReactHost;

    return-object v0
.end method

.method public onConfigurationChanged(Landroid/content/res/Configuration;)V
    .registers 3

    const-string v0, "newConfig"

    invoke-static {p1, v0}, Lkotlin/jvm/internal/Intrinsics;->checkNotNullParameter(Ljava/lang/Object;Ljava/lang/String;)V

    .line 42
    invoke-super {p0, p1}, Landroid/app/Application;->onConfigurationChanged(Landroid/content/res/Configuration;)V

    .line 43
    move-object v0, p0

    check-cast v0, Landroid/app/Application;

    invoke-static {v0, p1}, Lexpo/modules/ApplicationLifecycleDispatcher;->onConfigurationChanged(Landroid/app/Application;Landroid/content/res/Configuration;)V

    return-void
.end method

.method public onCreate()V
    .registers 4

    .line 31
    invoke-super {p0}, Landroid/app/Application;->onCreate()V

    .line 32
    sget-object v0, Lcom/facebook/react/defaults/DefaultNewArchitectureEntryPoint;->INSTANCE:Lcom/facebook/react/defaults/DefaultNewArchitectureEntryPoint;

    .line 33
    :try_start_5
    const-string v1, "stable"

    sget-object v2, Ljava/util/Locale;->ROOT:Ljava/util/Locale;

    invoke-virtual {v1, v2}, Ljava/lang/String;->toUpperCase(Ljava/util/Locale;)Ljava/lang/String;

    move-result-object v1

    const-string v2, "toUpperCase(...)"

    invoke-static {v1, v2}, Lkotlin/jvm/internal/Intrinsics;->checkNotNullExpressionValue(Ljava/lang/Object;Ljava/lang/String;)V

    invoke-static {v1}, Lcom/facebook/react/common/ReleaseLevel;->valueOf(Ljava/lang/String;)Lcom/facebook/react/common/ReleaseLevel;

    move-result-object v1
    :try_end_16
    .catch Ljava/lang/IllegalArgumentException; {:try_start_5 .. :try_end_16} :catch_17

    goto :goto_19

    .line 35
    :catch_17
    sget-object v1, Lcom/facebook/react/common/ReleaseLevel;->STABLE:Lcom/facebook/react/common/ReleaseLevel;

    .line 32
    :goto_19
    invoke-virtual {v0, v1}, Lcom/facebook/react/defaults/DefaultNewArchitectureEntryPoint;->setReleaseLevel(Lcom/facebook/react/common/ReleaseLevel;)V

    .line 37
    move-object v0, p0

    check-cast v0, Landroid/content/Context;

    invoke-static {v0}, Lcom/facebook/react/ReactNativeApplicationEntryPoint;->loadReactNative(Landroid/content/Context;)V

    .line 38
    move-object v0, p0

    check-cast v0, Landroid/app/Application;

    invoke-static {v0}, Lexpo/modules/ApplicationLifecycleDispatcher;->onApplicationCreate(Landroid/app/Application;)V

    return-void
.end method
