Types: Device, Message are defined in ../../types.ts

### POST: /client/device

Description: Creates a Device object, with fields filled in appropriately. id should be a 5 digit unique id.Messages arr empty. Stores the Device object in global Map of devices accessible thru any route (Map<Device.id, Device>)

Body:

```
name: string;
puf: string;
mac: string;

```

Returns: Device

### DELETE: /client/device

Description: Deletes the device from the global Map data;

Body:

```
id: string

```

### GET: /client/metadata

Returns: Device[] (parse device map into arr of devices)

### POST: /client/message

Description: Creates a message object using data provided and filling/constructing other props appropriately. Appends message to Device#messages. Stores data in blockchain using the storeHash() method imported from `../../contract.ts`

Body:

```
id: string;
data: any;

```

Returns: Message

### GET: /client/message?id={id}

Description: Returns list of messages fetched from Device#messages

Returns: Message[]


