import java.lang.reflect.*;import java.util.*;
public class NativeSpProbe {
 static Object call(Object target,String name,Class<?>[]types,Object...args)throws Exception{return target.getClass().getMethod(name,types).invoke(target,args);}
 public static void main(String[]args)throws Exception{
  Class<?> looper=Class.forName("android.os.Looper");looper.getMethod("prepareMainLooper").invoke(null);
  Class<?> at=Class.forName("android.app.ActivityThread");Object thread=at.getMethod("systemMain").invoke(null);Object context=at.getMethod("getSystemContext").invoke(thread);
  Class<?> contextClass=Class.forName("android.content.Context");ClassLoader loader=(ClassLoader)Class.forName("dalvik.system.PathClassLoader").getConstructor(String.class,String.class,ClassLoader.class).newInstance(args[0],args[1],ClassLoader.getSystemClassLoader());
  Class<?> configClass=Class.forName("android.content.res.Configuration"),mapClass=loader.loadClass("com.facebook.react.common.mapbuffer.MapBuffer"),writeClass=loader.loadClass("com.facebook.react.common.mapbuffer.WritableMapBuffer"),propsClass=loader.loadClass("com.facebook.react.views.text.TextAttributeProps");
  Class<?> display=loader.loadClass("com.facebook.react.uimanager.DisplayMetricsHolder");Object companion=propsClass.getField("Companion").get(null);Method from=companion.getClass().getMethod("fromMapBuffer",mapClass);Method putDouble=writeClass.getMethod("put",int.class,double.class),putBoolean=writeClass.getMethod("put",int.class,boolean.class);
  int pairs=0;StringBuilder out=new StringBuilder("{\"samples\":[");boolean comma=false;
  for(float scale:new float[]{0.85f,1f,1.3f,2f}){
   Object config=configClass.getConstructor().newInstance();configClass.getField("fontScale").setFloat(config,scale);Object scoped=contextClass.getMethod("createConfigurationContext",configClass).invoke(context,config);display.getMethod("initDisplayMetrics",contextClass).invoke(null,scoped);
   for(float size:new float[]{10f,14f,18f,32f,48f})for(boolean allow:new boolean[]{true,false})for(double cap:new double[]{Double.NaN,1.5}){
    int[]values=new int[2];for(int i=0;i<2;i++){Object map=writeClass.getConstructor().newInstance();putDouble.invoke(map,4,(double)size);putDouble.invoke(map,5,i==0?1d:(double)scale);putBoolean.invoke(map,9,allow);if(!Double.isNaN(cap))putDouble.invoke(map,29,cap);Object props=from.invoke(companion,map);values[i]=((Number)propsClass.getMethod("getFontSize").invoke(props)).intValue();}
    if(values[0]!=values[1])throw new AssertionError("font cache field changed painting");pairs++;if(comma)out.append(',');comma=true;out.append("{\"system_scale\":").append(scale).append(",\"font_sp\":").append(size).append(",\"allowFontScaling\":").append(allow).append(",\"maxMultiplier\":").append(Double.isNaN(cap)?"null":cap).append(",\"before_px\":").append(values[0]).append(",\"after_px\":").append(values[1]).append('}');
   }
  }
  out.append("],\"actual_android_RN_TextAttributeProps_pairs\":").append(pairs).append(",\"all_identical\":true}");System.out.println(out);
 }
}
