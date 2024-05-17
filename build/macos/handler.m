#include "handler.h"

@implementation GoPasser
+ (void)handleGetURLEvent:(NSAppleEventDescriptor *)event
{
	HandleURL([[[event paramDescriptorForKeyword:keyDirectObject] stringValue] UTF8String]);
}
@end

void StartURLHandler(void) {
  NSAppleEventManager *appleEventManager = [NSAppleEventManager sharedAppleEventManager];
    [appleEventManager setEventHandler:[GoPasser class]
      andSelector:@selector(handleGetURLEvent:)
      forEventClass:kInternetEventClass andEventID:kAEGetURL];
}