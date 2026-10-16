.class public Lcom/facebook/react/internal/featureflags/ReactNativeFeatureFlagsDefaults;
.super Ljava/lang/Object;
.source "ReactNativeFeatureFlagsDefaults.kt"

# interfaces
.implements Lcom/facebook/react/internal/featureflags/ReactNativeFeatureFlagsProvider;


# annotations
.annotation runtime Lkotlin/Metadata;
    d1 = {
        "\u0000\u001c\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0008\u0003\n\u0002\u0010\u000b\n\u0002\u0008C\n\u0002\u0010\u0006\n\u0002\u0008\u0019\u0008\u0016\u0018\u00002\u00020\u0001B\u0007\u00a2\u0006\u0004\u0008\u0002\u0010\u0003J\u0008\u0010\u0004\u001a\u00020\u0005H\u0016J\u0008\u0010\u0006\u001a\u00020\u0005H\u0016J\u0008\u0010\u0007\u001a\u00020\u0005H\u0016J\u0008\u0010\u0008\u001a\u00020\u0005H\u0016J\u0008\u0010\t\u001a\u00020\u0005H\u0016J\u0008\u0010\n\u001a\u00020\u0005H\u0016J\u0008\u0010\u000b\u001a\u00020\u0005H\u0016J\u0008\u0010\u000c\u001a\u00020\u0005H\u0016J\u0008\u0010\r\u001a\u00020\u0005H\u0016J\u0008\u0010\u000e\u001a\u00020\u0005H\u0016J\u0008\u0010\u000f\u001a\u00020\u0005H\u0016J\u0008\u0010\u0010\u001a\u00020\u0005H\u0016J\u0008\u0010\u0011\u001a\u00020\u0005H\u0016J\u0008\u0010\u0012\u001a\u00020\u0005H\u0016J\u0008\u0010\u0013\u001a\u00020\u0005H\u0016J\u0008\u0010\u0014\u001a\u00020\u0005H\u0016J\u0008\u0010\u0015\u001a\u00020\u0005H\u0016J\u0008\u0010\u0016\u001a\u00020\u0005H\u0016J\u0008\u0010\u0017\u001a\u00020\u0005H\u0016J\u0008\u0010\u0018\u001a\u00020\u0005H\u0016J\u0008\u0010\u0019\u001a\u00020\u0005H\u0016J\u0008\u0010\u001a\u001a\u00020\u0005H\u0016J\u0008\u0010\u001b\u001a\u00020\u0005H\u0016J\u0008\u0010\u001c\u001a\u00020\u0005H\u0016J\u0008\u0010\u001d\u001a\u00020\u0005H\u0016J\u0008\u0010\u001e\u001a\u00020\u0005H\u0016J\u0008\u0010\u001f\u001a\u00020\u0005H\u0016J\u0008\u0010 \u001a\u00020\u0005H\u0016J\u0008\u0010!\u001a\u00020\u0005H\u0016J\u0008\u0010\"\u001a\u00020\u0005H\u0016J\u0008\u0010#\u001a\u00020\u0005H\u0016J\u0008\u0010$\u001a\u00020\u0005H\u0016J\u0008\u0010%\u001a\u00020\u0005H\u0016J\u0008\u0010&\u001a\u00020\u0005H\u0016J\u0008\u0010\'\u001a\u00020\u0005H\u0016J\u0008\u0010(\u001a\u00020\u0005H\u0016J\u0008\u0010)\u001a\u00020\u0005H\u0016J\u0008\u0010*\u001a\u00020\u0005H\u0016J\u0008\u0010+\u001a\u00020\u0005H\u0016J\u0008\u0010,\u001a\u00020\u0005H\u0016J\u0008\u0010-\u001a\u00020\u0005H\u0016J\u0008\u0010.\u001a\u00020\u0005H\u0016J\u0008\u0010/\u001a\u00020\u0005H\u0016J\u0008\u00100\u001a\u00020\u0005H\u0016J\u0008\u00101\u001a\u00020\u0005H\u0016J\u0008\u00102\u001a\u00020\u0005H\u0016J\u0008\u00103\u001a\u00020\u0005H\u0016J\u0008\u00104\u001a\u00020\u0005H\u0016J\u0008\u00105\u001a\u00020\u0005H\u0016J\u0008\u00106\u001a\u00020\u0005H\u0016J\u0008\u00107\u001a\u00020\u0005H\u0016J\u0008\u00108\u001a\u00020\u0005H\u0016J\u0008\u00109\u001a\u00020\u0005H\u0016J\u0008\u0010:\u001a\u00020\u0005H\u0016J\u0008\u0010;\u001a\u00020\u0005H\u0016J\u0008\u0010<\u001a\u00020\u0005H\u0016J\u0008\u0010=\u001a\u00020\u0005H\u0016J\u0008\u0010>\u001a\u00020\u0005H\u0016J\u0008\u0010?\u001a\u00020\u0005H\u0016J\u0008\u0010@\u001a\u00020\u0005H\u0016J\u0008\u0010A\u001a\u00020\u0005H\u0016J\u0008\u0010B\u001a\u00020\u0005H\u0016J\u0008\u0010C\u001a\u00020\u0005H\u0016J\u0008\u0010D\u001a\u00020\u0005H\u0016J\u0008\u0010E\u001a\u00020\u0005H\u0016J\u0008\u0010F\u001a\u00020\u0005H\u0016J\u0008\u0010G\u001a\u00020\u0005H\u0016J\u0008\u0010H\u001a\u00020IH\u0016J\u0008\u0010J\u001a\u00020\u0005H\u0016J\u0008\u0010K\u001a\u00020\u0005H\u0016J\u0008\u0010L\u001a\u00020\u0005H\u0016J\u0008\u0010M\u001a\u00020\u0005H\u0016J\u0008\u0010N\u001a\u00020\u0005H\u0016J\u0008\u0010O\u001a\u00020\u0005H\u0016J\u0008\u0010P\u001a\u00020\u0005H\u0016J\u0008\u0010Q\u001a\u00020\u0005H\u0016J\u0008\u0010R\u001a\u00020\u0005H\u0016J\u0008\u0010S\u001a\u00020\u0005H\u0016J\u0008\u0010T\u001a\u00020\u0005H\u0016J\u0008\u0010U\u001a\u00020\u0005H\u0016J\u0008\u0010V\u001a\u00020\u0005H\u0016J\u0008\u0010W\u001a\u00020\u0005H\u0016J\u0008\u0010X\u001a\u00020\u0005H\u0016J\u0008\u0010Y\u001a\u00020\u0005H\u0016J\u0008\u0010Z\u001a\u00020\u0005H\u0016J\u0008\u0010[\u001a\u00020\u0005H\u0016J\u0008\u0010\\\u001a\u00020\u0005H\u0016J\u0008\u0010]\u001a\u00020\u0005H\u0016J\u0008\u0010^\u001a\u00020\u0005H\u0016J\u0008\u0010_\u001a\u00020IH\u0016J\u0008\u0010`\u001a\u00020\u0005H\u0016J\u0008\u0010a\u001a\u00020IH\u0016\u00a8\u0006b"
    }
    d2 = {
        "Lcom/facebook/react/internal/featureflags/ReactNativeFeatureFlagsDefaults;",
        "Lcom/facebook/react/internal/featureflags/ReactNativeFeatureFlagsProvider;",
        "<init>",
        "()V",
        "commonTestFlag",
        "",
        "cdpInteractionMetricsEnabled",
        "cxxNativeAnimatedEnabled",
        "defaultTextToOverflowHidden",
        "disableEarlyViewCommandExecution",
        "disableImageViewPreallocationAndroid",
        "disableMountItemReorderingAndroid",
        "disableSubviewClippingAndroid",
        "disableTextLayoutManagerCacheAndroid",
        "disableViewPreallocationAndroid",
        "enableAccessibilityOrder",
        "enableAccumulatedUpdatesInRawPropsAndroid",
        "enableAndroidTextMeasurementOptimizations",
        "enableBridgelessArchitecture",
        "enableCppPropsIteratorSetter",
        "enableCustomFocusSearchOnClippedElementsAndroid",
        "enableDestroyShadowTreeRevisionAsync",
        "enableDifferentiatorMutationVectorPreallocation",
        "enableDoubleMeasurementFixAndroid",
        "enableEagerMainQueueModulesOnIOS",
        "enableEagerRootViewAttachment",
        "enableExclusivePropsUpdateAndroid",
        "enableFabricCommitBranching",
        "enableFabricLogs",
        "enableFabricRenderer",
        "enableFontScaleChangesUpdatingLayout",
        "enableIOSTextBaselineOffsetPerLine",
        "enableIOSViewClipToPaddingBox",
        "enableImagePrefetchingAndroid",
        "enableImmediateUpdateModeForContentOffsetChanges",
        "enableImperativeFocus",
        "enableInteropViewManagerClassLookUpOptimizationIOS",
        "enableIntersectionObserverByDefault",
        "enableKeyEvents",
        "enableLayoutAnimationsOnAndroid",
        "enableLayoutAnimationsOnIOS",
        "enableMainQueueCoordinatorOnIOS",
        "enableModuleArgumentNSNullConversionIOS",
        "enableMutationObserverByDefault",
        "enableNativeCSSParsing",
        "enableNativeViewPropTransformations",
        "enableNetworkEventReporting",
        "enablePreparedTextLayout",
        "enablePropsUpdateReconciliationAndroid",
        "enableSchedulerDelegateInvalidation",
        "enableSwiftUIBasedFilters",
        "enableViewCulling",
        "enableViewRecycling",
        "enableViewRecyclingForImage",
        "enableViewRecyclingForScrollView",
        "enableViewRecyclingForText",
        "enableViewRecyclingForView",
        "enableVirtualViewContainerStateExperimental",
        "enableVirtualViewDebugFeatures",
        "fixDifferentiatorParentTagForUnflattenCase",
        "fixFindShadowNodeByTagRaceCondition",
        "fixMappingOfEventPrioritiesBetweenFabricAndReact",
        "fixYogaFlexBasisFitContentInMainAxis",
        "fuseboxAssertSingleHostState",
        "fuseboxEnabledRelease",
        "fuseboxFrameRecordingEnabled",
        "fuseboxNetworkInspectionEnabled",
        "fuseboxScreenshotCaptureEnabled",
        "hideOffscreenVirtualViewsOnIOS",
        "overrideBySynchronousMountPropsAtMountingAndroid",
        "perfIssuesEnabled",
        "perfMonitorV2Enabled",
        "preparedTextCacheSize",
        "",
        "preventShadowTreeCommitExhaustion",
        "redBoxV2Android",
        "redBoxV2IOS",
        "shouldPressibilityUseW3CPointerEventsForHover",
        "shouldTriggerResponderTransferOnScrollAndroid",
        "skipActivityIdentityAssertionOnHostPause",
        "syncAndroidClipBoundsWithOverflow",
        "traceTurboModulePromiseRejectionsOnAndroid",
        "updateRuntimeShadowNodeReferencesOnCommit",
        "updateRuntimeShadowNodeReferencesOnCommitThread",
        "useAlwaysAvailableJSErrorHandling",
        "useFabricInterop",
        "useLISAlgorithmInDifferentiator",
        "useNativeViewConfigsInBridgelessMode",
        "useNestedScrollViewAndroid",
        "useOptimizedViewRegistryOnAndroid",
        "useSharedAnimatedBackend",
        "useTraitHiddenOnAndroid",
        "useTurboModuleInterop",
        "useTurboModules",
        "useUnorderedMapInDifferentiator",
        "viewCullingOutsetRatio",
        "viewTransitionEnabled",
        "virtualViewPrerenderRatio",
        "ReactAndroid_release"
    }
    k = 0x1
    mv = {
        0x2,
        0x1,
        0x0
    }
    xi = 0x30
.end annotation


# direct methods
.method public constructor <init>()V
    .registers 1

    .line 22
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    return-void
.end method


# virtual methods
.method public cdpInteractionMetricsEnabled()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public commonTestFlag()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public cxxNativeAnimatedEnabled()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public defaultTextToOverflowHidden()Z
    .registers 2

    const/4 v0, 0x1

    return v0
.end method

.method public disableEarlyViewCommandExecution()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public disableImageViewPreallocationAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public disableMountItemReorderingAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public disableSubviewClippingAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public disableTextLayoutManagerCacheAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public disableViewPreallocationAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableAccessibilityOrder()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableAccumulatedUpdatesInRawPropsAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableAndroidTextMeasurementOptimizations()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableBridgelessArchitecture()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableCppPropsIteratorSetter()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableCustomFocusSearchOnClippedElementsAndroid()Z
    .registers 2

    const/4 v0, 0x1

    return v0
.end method

.method public enableDestroyShadowTreeRevisionAsync()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableDifferentiatorMutationVectorPreallocation()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableDoubleMeasurementFixAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableEagerMainQueueModulesOnIOS()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableEagerRootViewAttachment()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableExclusivePropsUpdateAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableFabricCommitBranching()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableFabricLogs()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableFabricRenderer()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableFontScaleChangesUpdatingLayout()Z
    .registers 2

    const/4 v0, 0x1

    return v0
.end method

.method public enableIOSTextBaselineOffsetPerLine()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableIOSViewClipToPaddingBox()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableImagePrefetchingAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableImmediateUpdateModeForContentOffsetChanges()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableImperativeFocus()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableInteropViewManagerClassLookUpOptimizationIOS()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableIntersectionObserverByDefault()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableKeyEvents()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableLayoutAnimationsOnAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableLayoutAnimationsOnIOS()Z
    .registers 2

    const/4 v0, 0x1

    return v0
.end method

.method public enableMainQueueCoordinatorOnIOS()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableModuleArgumentNSNullConversionIOS()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableMutationObserverByDefault()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableNativeCSSParsing()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableNativeViewPropTransformations()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableNetworkEventReporting()Z
    .registers 2

    const/4 v0, 0x1

    return v0
.end method

.method public enablePreparedTextLayout()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enablePropsUpdateReconciliationAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableSchedulerDelegateInvalidation()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableSwiftUIBasedFilters()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableViewCulling()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableViewRecycling()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableViewRecyclingForImage()Z
    .registers 2

    const/4 v0, 0x1

    return v0
.end method

.method public enableViewRecyclingForScrollView()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableViewRecyclingForText()Z
    .registers 2

    const/4 v0, 0x1

    return v0
.end method

.method public enableViewRecyclingForView()Z
    .registers 2

    const/4 v0, 0x1

    return v0
.end method

.method public enableVirtualViewContainerStateExperimental()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public enableVirtualViewDebugFeatures()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public fixDifferentiatorParentTagForUnflattenCase()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public fixFindShadowNodeByTagRaceCondition()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public fixMappingOfEventPrioritiesBetweenFabricAndReact()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public fixYogaFlexBasisFitContentInMainAxis()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public fuseboxAssertSingleHostState()Z
    .registers 2

    const/4 v0, 0x1

    return v0
.end method

.method public fuseboxEnabledRelease()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public fuseboxFrameRecordingEnabled()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public fuseboxNetworkInspectionEnabled()Z
    .registers 2

    const/4 v0, 0x1

    return v0
.end method

.method public fuseboxScreenshotCaptureEnabled()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public hideOffscreenVirtualViewsOnIOS()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public overrideBySynchronousMountPropsAtMountingAndroid()Z
    .registers 2

    const/4 v0, 0x1

    return v0
.end method

.method public perfIssuesEnabled()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public perfMonitorV2Enabled()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public preparedTextCacheSize()D
    .registers 3

    const-wide/high16 v0, 0x4069000000000000L    # 200.0

    return-wide v0
.end method

.method public preventShadowTreeCommitExhaustion()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public redBoxV2Android()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public redBoxV2IOS()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public shouldPressibilityUseW3CPointerEventsForHover()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public shouldTriggerResponderTransferOnScrollAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public skipActivityIdentityAssertionOnHostPause()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public syncAndroidClipBoundsWithOverflow()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public traceTurboModulePromiseRejectionsOnAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public updateRuntimeShadowNodeReferencesOnCommit()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public updateRuntimeShadowNodeReferencesOnCommitThread()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public useAlwaysAvailableJSErrorHandling()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public useFabricInterop()Z
    .registers 2

    const/4 v0, 0x1

    return v0
.end method

.method public useLISAlgorithmInDifferentiator()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public useNativeViewConfigsInBridgelessMode()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public useNestedScrollViewAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public useOptimizedViewRegistryOnAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public useSharedAnimatedBackend()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public useTraitHiddenOnAndroid()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public useTurboModuleInterop()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public useTurboModules()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public useUnorderedMapInDifferentiator()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public viewCullingOutsetRatio()D
    .registers 3

    const-wide/16 v0, 0x0

    return-wide v0
.end method

.method public viewTransitionEnabled()Z
    .registers 2

    const/4 v0, 0x0

    return v0
.end method

.method public virtualViewPrerenderRatio()D
    .registers 3

    const-wide/high16 v0, 0x4014000000000000L    # 5.0

    return-wide v0
.end method
