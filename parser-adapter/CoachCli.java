package opendota;

import java.io.BufferedInputStream;
import java.io.InputStream;
import java.io.BufferedOutputStream;
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream;
import org.apache.commons.compress.compressors.zstandard.ZstdCompressorInputStream;

/** Local-only adapter for the MIT-licensed OpenDota parser. No HTTP listener. */
public class CoachCli {
    public static void main(String[] args) throws Exception {
        BufferedInputStream source = new BufferedInputStream(System.in);
        source.mark(8);
        byte[] header = source.readNBytes(4);
        source.reset();
        InputStream replay = source;
        if (header.length >= 3 && header[0] == 'B' && header[1] == 'Z' && header[2] == 'h') {
            replay = new BZip2CompressorInputStream(source);
        } else if (header.length == 4 && (header[0] & 255) == 0x28 && (header[1] & 255) == 0xB5 && (header[2] & 255) == 0x2F && (header[3] & 255) == 0xFD) {
            replay = new ZstdCompressorInputStream(source);
        }
        BufferedOutputStream output = new BufferedOutputStream(System.out);
        new Parse(replay, output, false);
        output.flush();
    }
}
